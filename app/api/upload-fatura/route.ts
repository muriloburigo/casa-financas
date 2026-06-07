import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/utils";
import { extractText } from "unpdf";

export const maxDuration = 120;

const invoiceSchema = z.object({
  totalAmount: z.number().describe("Valor total da fatura em reais"),
  transactions: z.array(
    z.object({
      description: z.string().describe("Descrição da transação como aparece na fatura"),
      amount: z.number().describe("Valor em reais (positivo)"),
      date: z.string().optional().describe("Data no formato DD/MM ou DD/MM/YYYY"),
      merchant: z.string().optional().describe("Nome do estabelecimento limpo"),
      category: z.string().describe(`Uma das categorias: ${EXPENSE_CATEGORIES.join(", ")}`),
      subcategory: z.string().optional(),
      isOptimizable: z.boolean().describe("Esta compra poderia ser evitada ou reduzida?"),
      notes: z.string().optional().describe("Dica de otimização específica se aplicável"),
    })
  ),
  optimizationSummary: z.string().describe("Resumo em 2-3 frases das principais oportunidades de otimização encontradas"),
});

const SYSTEM_PROMPT = (cardName: string) =>
  `Você é um analista financeiro especialista em faturas de cartão de crédito brasileiro.
Analise a fatura do ${cardName} e extraia TODAS as transações de compra (ignore pagamentos, créditos e ajustes).
Classifique cada transação nas categorias disponíveis.
Marque como otimizável qualquer gasto supérfluo, duplicado ou que poderia ser reduzido.
Responda sempre em português brasileiro.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const cardName = formData.get("cardName") as string;
  const month = parseInt(formData.get("month") as string);
  const year = parseInt(formData.get("year") as string);

  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  let textContent: string;

  if (isPdf) {
    // Extrai texto do PDF com pdf-parse (funciona com PDFs digitais como Nubank)
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
    textContent = Array.isArray(text) ? text.join("\n") : text;

    if (!textContent || textContent.trim().length < 50) {
      return Response.json(
        { error: "Não foi possível extrair texto do PDF. Tente subir o CSV da fatura." },
        { status: 422 }
      );
    }
  } else {
    textContent = await file.text();
  }

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: invoiceSchema,
    messages: [
      {
        role: "user",
        content: `${SYSTEM_PROMPT(cardName)}\n\nTexto extraído da fatura:\n\n${textContent.slice(0, 15000)}`,
      },
    ],
  });

  // Encontra o lançamento existente deste cartão neste mês, ou cria um novo
  const existing = await db
    .select()
    .from(expenseEntries)
    .where(
      and(
        eq(expenseEntries.creditCardName, cardName),
        eq(expenseEntries.month, month),
        eq(expenseEntries.year, year)
      )
    )
    .limit(1);

  let expEntryId: string;

  if (existing.length > 0) {
    await db
      .update(expenseEntries)
      .set({ amount: object.totalAmount.toString(), status: "paid" })
      .where(eq(expenseEntries.id, existing[0].id));
    expEntryId = existing[0].id;
    await db
      .delete(creditCardTransactions)
      .where(eq(creditCardTransactions.expenseEntryId, expEntryId));
  } else {
    const [newEntry] = await db
      .insert(expenseEntries)
      .values({
        description: cardName,
        amount: object.totalAmount.toString(),
        month,
        year,
        status: "paid",
        isCreditCard: true,
        creditCardName: cardName,
      })
      .returning();
    expEntryId = newEntry.id;
  }

  if (object.transactions.length > 0) {
    await db.insert(creditCardTransactions).values(
      object.transactions.map((t) => ({
        expenseEntryId: expEntryId,
        description: t.description,
        amount: t.amount.toString(),
        transactionDate: t.date ?? null,
        merchant: t.merchant ?? null,
        aiCategory: t.category,
        aiSubcategory: t.subcategory ?? null,
        aiNotes: t.notes ?? null,
        isOptimizable: t.isOptimizable,
      }))
    );
  }

  return Response.json({
    success: true,
    totalAmount: object.totalAmount,
    transactionCount: object.transactions.length,
    optimizationSummary: object.optimizationSummary,
    transactions: object.transactions,
    expenseEntryId: expEntryId,
  });
}
