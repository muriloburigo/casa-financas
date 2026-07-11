import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions, categoryRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface CategoryItem {
  description: string;
  amount: number;
  cardName?: string; // presente quando o item veio de uma transação de cartão
}

export interface CategoryBreakdownEntry {
  category: string;
  amount: number;
  items: CategoryItem[];
}

// Soma o gasto de um mês por categoria: despesas de cartão usam a categoria
// atribuída pela IA em cada transação; despesas fixas casam a descrição
// contra as regras cadastradas (categoryRules), caindo em "Outros" se nada bater.
// Também devolve os itens que compõem cada categoria, para permitir "ver detalhes".
export async function getCategoryBreakdown(month: number, year: number): Promise<CategoryBreakdownEntry[]> {
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
  const itemsMap: Record<string, CategoryItem[]> = {};

  function addItem(category: string, item: CategoryItem) {
    categoryMap[category] = (categoryMap[category] ?? 0) + item.amount;
    (itemsMap[category] ??= []).push(item);
  }

  for (const entry of entries) {
    if (entry.isCreditCard) {
      const txs = await db
        .select()
        .from(creditCardTransactions)
        .where(eq(creditCardTransactions.expenseEntryId, entry.id));

      // Só contribui para o breakdown se a fatura foi analisada (tem transações)
      for (const tx of txs) {
        const cat = tx.aiCategory ?? "Outros";
        addItem(cat, { description: tx.description, amount: parseFloat(tx.amount), cardName: entry.creditCardName ?? undefined });
      }
    } else {
      const cat = matchCategory(entry.description);
      addItem(cat, { description: entry.description, amount: parseFloat(entry.amount) });
    }
  }

  return Object.entries(categoryMap).map(([category, amount]) => ({
    category,
    amount,
    items: (itemsMap[category] ?? []).sort((a, b) => b.amount - a.amount),
  }));
}
