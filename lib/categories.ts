import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions, categoryRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Soma o gasto de um mês por categoria: despesas de cartão usam a categoria
// atribuída pela IA em cada transação; despesas fixas casam a descrição
// contra as regras cadastradas (categoryRules), caindo em "Outros" se nada bater.
export async function getCategoryBreakdown(month: number, year: number): Promise<{ category: string; amount: number }[]> {
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
      const cat = matchCategory(entry.description);
      categoryMap[cat] = (categoryMap[cat] ?? 0) + parseFloat(entry.amount);
    }
  }

  return Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));
}
