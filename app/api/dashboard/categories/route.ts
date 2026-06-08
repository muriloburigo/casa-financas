import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions, categoryRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [entries, rules] = await Promise.all([
    db.select().from(expenseEntries).where(and(eq(expenseEntries.month, month), eq(expenseEntries.year, year))),
    db.select().from(categoryRules),
  ]);

  function matchCategory(description: string): string {
    const lower = description.toLowerCase();
    for (const rule of rules) {
      if (lower.includes(rule.pattern.toLowerCase())) return rule.category;
    }
    return "Outros";
  }

  const categoryMap: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.isCreditCard) {
      const txs = await db
        .select()
        .from(creditCardTransactions)
        .where(eq(creditCardTransactions.expenseEntryId, entry.id));

      // Só contribui para o breakdown se a fatura foi analisada (tem transações)
      for (const tx of txs) {
        const cat = tx.aiCategory ?? "Outros";
        categoryMap[cat] = (categoryMap[cat] ?? 0) + parseFloat(tx.amount);
      }
    } else {
      // Despesa fixa: categoriza pela regra ou cai em Outros
      const cat = matchCategory(entry.description);
      categoryMap[cat] = (categoryMap[cat] ?? 0) + parseFloat(entry.amount);
    }
  }

  const total = Object.values(categoryMap).reduce((s, v) => s + v, 0);
  const categories = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return Response.json({ categories, total });
}
