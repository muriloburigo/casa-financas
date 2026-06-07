import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const cardName = formData.get("cardName") as string;
  const month = parseInt(formData.get("month") as string);
  const year = parseInt(formData.get("year") as string);

  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });

  const text = await file.text();

  // Use Claude to parse and classify the invoice
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: z.object({
      totalAmount: z.number().describe("Valor total da fatura"),
      transactions: z.array(
        z.object({
          description: z.string(),
          amount: z.number(),
          date: z.string().optional(),
          merchant: z.string().optional(),
          category: z.string().describe(`Categoria: ${EXPENSE_CATEGORIES.join(", ")}`),
          subcategory: z.string().optional(),
          isOptimizable: z.boolean().describe("Esta compra poderia ser evitada ou reduzida?"),
          notes: z.string().optional().describe("Observação de otimização se aplicável"),
        })
      ),
      optimizationSummary: z.string().describe("Resumo de oportunidades de otimização encontradas"),
    }),
    prompt: `Você é um analista financeiro. Analise esta fatura de cartão de crédito (${cardName}) e:
1. Extraia cada transação
2. Classifique em categorias: ${EXPENSE_CATEGORIES.join(", ")}
3. Identifique compras que poderiam ser otimizadas/reduzidas
4. Forneça um resumo de oportunidades

Fatura (CSV/texto):
${text.slice(0, 8000)}`,
  });

  // Save the expense entry for the card
  const [expEntry] = await db
    .insert(expenseEntries)
    .values({
      description: `${cardName} — Fatura`,
      amount: object.totalAmount.toString(),
      month,
      year,
      status: "paid",
      isCreditCard: true,
      creditCardName: cardName,
    })
    .returning();

  // Save individual transactions
  if (object.transactions.length > 0) {
    await db.insert(creditCardTransactions).values(
      object.transactions.map((t) => ({
        expenseEntryId: expEntry.id,
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
    expenseEntryId: expEntry.id,
  });
}
