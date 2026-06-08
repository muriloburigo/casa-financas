import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions, categoryRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.SEED_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = parseInt(searchParams.get("month") ?? "6");
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [entries, rules] = await Promise.all([
    db.select().from(expenseEntries).where(and(eq(expenseEntries.month, month), eq(expenseEntries.year, year))),
    db.select().from(categoryRules),
  ]);

  const detail = await Promise.all(
    entries.map(async (e) => {
      const txs = await db
        .select({ id: creditCardTransactions.id, description: creditCardTransactions.description, amount: creditCardTransactions.amount, aiCategory: creditCardTransactions.aiCategory })
        .from(creditCardTransactions)
        .where(eq(creditCardTransactions.expenseEntryId, e.id));

      return {
        id: e.id,
        description: e.description,
        amount: e.amount,
        isCreditCard: e.isCreditCard,
        creditCardName: e.creditCardName,
        txCount: txs.length,
        nullCategoryTxs: txs.filter((t) => !t.aiCategory).length,
        sampleTxCategories: [...new Set(txs.map((t) => t.aiCategory ?? "NULL"))].slice(0, 8),
        sampleNullTxs: txs.filter((t) => !t.aiCategory).slice(0, 3).map((t) => t.description),
      };
    })
  );

  return Response.json({ month, year, rules: rules.map((r) => r.pattern + " → " + r.category), entries: detail });
}
