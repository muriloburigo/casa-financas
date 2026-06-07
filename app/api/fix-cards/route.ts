import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";

// POST /api/fix-cards — protegido por SEED_SECRET
// Remove duplicatas antigas e garante os 3 cartões em todos os meses com valores corretos
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const year = 2026;
  const report: string[] = [];

  // 1. Remove entradas com formato antigo "Nubank Mu — Fatura" / "Nubank Ma — Fatura" / "Cartão Caixa — Fatura"
  const oldFormat = await db
    .select()
    .from(expenseEntries)
    .where(like(expenseEntries.description, "% — Fatura"));

  for (const entry of oldFormat) {
    // Remove credit card transactions vinculadas antes
    await db.delete(creditCardTransactions).where(eq(creditCardTransactions.expenseEntryId, entry.id));
    await db.delete(expenseEntries).where(eq(expenseEntries.id, entry.id));
    report.push(`Removido: "${entry.description}" (mês ${entry.month})`);
  }

  // 2. Dados dos três cartões por mês (da planilha original)
  // Nubank Ma: meses 6-12 usam R$ 926 (média dos meses 1-5 com valor)
  const cards = [
    {
      name: "Nubank Ma",
      amounts: [606.56, 1957.25, 1330.58, 487.33, 248.49, 926, 926, 926, 926, 926, 926, 926],
    },
    {
      name: "Nubank Mu",
      amounts: [6963.51, 7768.95, 5159.85, 5944.35, 7409.68, 8659.64, 5000, 5000, 5000, 5000, 5000, 5000],
    },
    {
      name: "Cartão Caixa",
      amounts: [7700.73, 11005.33, 10597.71, 8597.20, 8077.61, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
    },
  ];

  const paidMonths = 5;

  for (const card of cards) {
    for (let m = 1; m <= 12; m++) {
      const amount = card.amounts[m - 1];
      if (amount === 0) continue;

      // Verifica se já existe entrada para este cartão/mês
      const existing = await db
        .select()
        .from(expenseEntries)
        .where(
          and(
            eq(expenseEntries.creditCardName, card.name),
            eq(expenseEntries.month, m),
            eq(expenseEntries.year, year)
          )
        );

      if (existing.length === 0) {
        // Cria entrada faltante
        await db.insert(expenseEntries).values({
          description: card.name,
          amount: amount.toString(),
          month: m,
          year,
          status: m <= paidMonths ? "paid" : "estimated",
          isCreditCard: true,
          creditCardName: card.name,
        });
        report.push(`Criado: "${card.name}" mês ${m} — R$ ${amount}`);
      } else if (existing.length > 1) {
        // Remove duplicatas extras (mantém o primeiro)
        for (const dup of existing.slice(1)) {
          await db.delete(creditCardTransactions).where(eq(creditCardTransactions.expenseEntryId, dup.id));
          await db.delete(expenseEntries).where(eq(expenseEntries.id, dup.id));
          report.push(`Removido duplicado: "${card.name}" mês ${m}`);
        }
      }
    }
  }

  return Response.json({ success: true, changes: report });
}
