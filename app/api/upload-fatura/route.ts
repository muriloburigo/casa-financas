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

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, "")
    .trim();
}

// Converte "DD/MM" ou "DD/MM/YYYY" → "YYYY-MM-DD" (ou null se inválido)
function parseDate(raw: string | undefined, year: number): string | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length < 2) return null;
  const [d, m, y] = parts;
  const fullYear = y ? parseInt(y) : year;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  const candidate = `${fullYear}-${month}-${day}`;
  return isNaN(Date.parse(candidate)) ? null : candidate;
}

// POST /api/upload-fatura — Etapa 1: extrai texto do PDF
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  let textContent: string;

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
    textContent = cleanText(Array.isArray(text) ? text.join("\n") : text);

    if (textContent.trim().length < 50) {
      return Response.json(
        { error: "Não foi possível extrair texto do PDF. Tente o CSV da fatura." },
        { status: 422 }
      );
    }
  } else {
    textContent = cleanText(await file.text());
  }

  return Response.json({ extracted: textContent.slice(0, 8000), charCount: textContent.length });
}

// PUT /api/upload-fatura — Etapa 2: analisa texto com IA e salva
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { text, cardName, month, year } = body as {
    text: string;
    cardName: string;
    month: number;
    year: number;
  };

  if (!text || !cardName) return Response.json({ error: "Dados incompletos" }, { status: 400 });

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
            `Analise a fatura do ${cardName} e extraia:`,
            `1. totalAmount: valor total`,
            `2. transactions: lista de compras (ignore pagamentos e créditos)`,
            `   description, amount (reais), date (DD/MM), isOptimizable, notes (só se otimizável)`,
            `   category: uma de [${EXPENSE_CATEGORIES.join(", ")}]`,
            `3. optimizationSummary: 1-2 frases`,
            ``,
            `FATURA:`,
            text,
          ].join("\n"),
        },
      ],
    });
    object = result.object;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI error:", msg);
    return Response.json({ error: `Erro na análise IA: ${msg.slice(0, 200)}` }, { status: 500 });
  }

  // Upsert lançamento
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
    await db.delete(creditCardTransactions).where(eq(creditCardTransactions.expenseEntryId, expEntryId));
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
        transactionDate: parseDate(t.date, year),
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
