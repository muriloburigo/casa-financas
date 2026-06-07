import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/utils";

export const maxDuration = 60;

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

  let result;

  if (isPdf) {
    // PDF → Buffer → Claude com suporte nativo a documentos PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    result = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: invoiceSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: buffer,
              mimeType: "application/pdf",
              filename: file.name,
            },
            {
              type: "text",
              text: `${SYSTEM_PROMPT(cardName)}\n\nExtraia todas as transações desta fatura PDF do ${cardName}.`,
            },
          ],
        },
      ],
    });
  } else {
    // CSV / texto simples
    const text = await file.text();
    result = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: invoiceSchema,
      messages: [
        {
          role: "user",
          content: `${SYSTEM_PROMPT(cardName)}\n\nFatura (CSV/texto):\n${text.slice(0, 12000)}`,
        },
      ],
    });
  }

  const { object } = result;

  // Salva entrada de despesa do cartão
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

  // Salva transações individuais
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
