import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "2026");

  const entries = await db
    .select()
    .from(expenseEntries)
    .where(
      and(
        eq(expenseEntries.isCreditCard, true),
        eq(expenseEntries.month, month),
        eq(expenseEntries.year, year)
      )
    );

  type TxWithCard = {
    id: string;
    description: string;
    amount: number;
    cardName: string;
    category: string;
    transactionDate: string | null;
    isOptimizable: boolean;
    aiNotes: string | null;
  };

  const allTxs: TxWithCard[] = (
    await Promise.all(
      entries.map(async (e) => {
        const txs = await db
          .select()
          .from(creditCardTransactions)
          .where(eq(creditCardTransactions.expenseEntryId, e.id));
        return txs.map((tx) => ({
          id: tx.id,
          description: tx.description,
          amount: parseFloat(tx.amount),
          cardName: e.creditCardName ?? "Cartão",
          category: tx.aiCategory ?? "Outros",
          transactionDate: tx.transactionDate,
          isOptimizable: tx.isOptimizable ?? false,
          aiNotes: tx.aiNotes ?? null,
        }));
      })
    )
  ).flat();

  const categoryMap: Record<string, { total: number; transactions: TxWithCard[] }> = {};
  for (const tx of allTxs) {
    const cat = tx.category;
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, transactions: [] };
    categoryMap[cat].total += tx.amount;
    categoryMap[cat].transactions.push(tx);
  }

  const categories = Object.entries(categoryMap)
    .map(([category, { total, transactions }]) => ({
      category,
      total,
      count: transactions.length,
      transactions: transactions.sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.total - a.total);

  const totalAmount = entries.reduce((s, e) => s + parseFloat(e.amount), 0);

  return Response.json({ month, year, totalAmount, categories, transactionCount: allTxs.length });
}
