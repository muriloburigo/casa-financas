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
  totalAmount: z.number(),
  transactions: z.array(
    z.object({
      description: z.string(),
      amount: z.number(),
      date: z.string().optional(),
      category: z.string(),
      isOptimizable: z.boolean(),
      notes: z.string().optional(),
    })
  ),
  optimizationSummary: z.string(),
});

function cleanPdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")           // colapsa espaços
    .replace(/\n{3,}/g, "\n\n")        // colapsa linhas em branco
    .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, "") // remove chars de controle
    .trim();
}

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
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n") : text;
    textContent = cleanPdfText(raw);

    if (textContent.trim().length < 50) {
      return Response.json(
        { error: "Não foi possível extrair texto do PDF. Tente o CSV da fatura." },
        { status: 422 }
      );
    }
  } else {
    textContent = cleanPdfText(await file.text());
  }

  // Limita a 8000 chars para não explodir o contexto de saída
  const excerpt = textContent.slice(0, 8000);

  let object: z.infer<typeof invoiceSchema>;

  try {
    const result = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: invoiceSchema,
      maxTokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            `Você é um analista de faturas de cartão brasileiro.`,
            `Extraia do texto abaixo da fatura do ${cardName}:`,
            `1. totalAmount: valor total da fatura`,
            `2. transactions: lista de compras (ignore pagamentos e créditos)`,
            `   - description: nome como aparece na fatura`,
            `   - amount: valor em reais (positivo)`,
            `   - date: data DD/MM se disponível`,
            `   - category: uma de [${EXPENSE_CATEGORIES.join(", ")}]`,
            `   - isOptimizable: true se gasto supérfluo ou reduzível`,
            `   - notes: dica curta de otimização (só se isOptimizable)`,
            `3. optimizationSummary: 1-2 frases sobre os maiores gastos`,
            ``,
            `FATURA:`,
            excerpt,
          ].join("\n"),
        },
      ],
    });
    object = result.object;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("generateObject error:", errMsg);
    return Response.json(
      { error: `Erro ao analisar fatura: ${errMsg.slice(0, 200)}` },
      { status: 500 }
    );
  }

  // Upsert lançamento do cartão
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
        merchant: null,
        aiCategory: t.category,
        aiSubcategory: null,
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
