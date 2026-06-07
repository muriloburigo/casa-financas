import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { expenseEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/utils";

export const maxDuration = 120;

// GET — lista faturas de cartão que têm transações detalhadas
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const entries = await db
    .select()
    .from(expenseEntries)
    .where(and(eq(expenseEntries.isCreditCard, true), eq(expenseEntries.year, year)))
    .orderBy(expenseEntries.month);

  // Para cada entrada, conta as transações
  const result = await Promise.all(
    entries.map(async (e) => {
      const txs = await db
        .select()
        .from(creditCardTransactions)
        .where(eq(creditCardTransactions.expenseEntryId, e.id));
      return { ...e, transactionCount: txs.length, hasDetail: txs.length > 0 };
    })
  );

  return Response.json({ invoices: result });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Converte "DD/MM" ou "DD/MM/YYYY" → "YYYY-MM-DD" (ou null se inválido)
function parseDate(raw: string | undefined, year: number): string | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length < 2) return null;
  const [d, m, y] = parts;
  const fullYear = y ? parseInt(y) : year;
  const candidate = `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isNaN(Date.parse(candidate)) ? null : candidate;
}

// POST — Etapa 1: lê o PDF e retorna info básica para confirmar antes de analisar
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Para CSV/texto, lê como texto mesmo
  if (!isPdf) {
    const text = await file.text();
    return Response.json({
      mode: "text",
      preview: text.slice(0, 800),
      fullText: text,
      size: file.size,
      name: file.name,
    });
  }

  return Response.json({
    mode: "pdf",
    base64,
    mimeType: "application/pdf",
    size: file.size,
    name: file.name,
    preview: `PDF de ${(file.size / 1024).toFixed(0)} KB · ${file.name}`,
  });
}

// PUT — Etapa 2: envia para o Claude e salva no banco
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { base64, mimeType, fullText, cardName, month, year, mode } = body as {
    base64?: string;
    mimeType?: string;
    fullText?: string;
    cardName: string;
    month: number;
    year: number;
    mode: "pdf" | "text";
  };

  const prompt = [
    `Analise a fatura do cartão ${cardName} e retorne um JSON com a estrutura:`,
    `{`,
    `  "totalAmount": número (valor total da fatura em reais),`,
    `  "transactions": [`,
    `    {`,
    `      "description": "nome como aparece na fatura",`,
    `      "amount": número em reais positivo,`,
    `      "date": "DD/MM" se disponível,`,
    `      "category": uma de [${EXPENSE_CATEGORIES.join(", ")}],`,
    `      "isOptimizable": true se gasto supérfluo ou reduzível,`,
    `      "notes": "dica curta" (só se isOptimizable)`,
    `    }`,
    `  ],`,
    `  "optimizationSummary": "1-2 frases sobre maiores gastos"`,
    `}`,
    ``,
    `Ignore pagamentos, créditos e ajustes. Retorne APENAS o JSON, sem markdown.`,
  ].join("\n");

  let responseText: string;

  try {
    if (mode === "pdf" && base64 && mimeType) {
      const msg = await client.beta.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        betas: ["pdfs-2024-09-25"],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              } as Anthropic.Beta.BetaRequestDocumentBlock,
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      responseText = (msg.content[0] as Anthropic.TextBlock).text;
    } else {
      // CSV / texto
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nFATURA:\n${(fullText ?? "").slice(0, 30000)}`,
          },
        ],
      });
      responseText = (msg.content[0] as Anthropic.TextBlock).text;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Anthropic error:", msg);
    return Response.json({ error: `Erro na análise: ${msg.slice(0, 300)}` }, { status: 500 });
  }

  // Parse do JSON retornado pelo Claude
  let object: {
    totalAmount: number;
    transactions: Array<{
      description: string;
      amount: number;
      date?: string;
      category: string;
      isOptimizable: boolean;
      notes?: string;
    }>;
    optimizationSummary: string;
  };

  try {
    const clean = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    object = JSON.parse(clean);
  } catch {
    console.error("JSON parse error, raw:", responseText.slice(0, 500));
    return Response.json({ error: "Resposta da IA não era JSON válido. Tente novamente." }, { status: 500 });
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
      .set({ amount: String(object.totalAmount), status: "paid" })
      .where(eq(expenseEntries.id, existing[0].id));
    expEntryId = existing[0].id;
    await db.delete(creditCardTransactions).where(eq(creditCardTransactions.expenseEntryId, expEntryId));
  } else {
    const [newEntry] = await db
      .insert(expenseEntries)
      .values({
        description: cardName,
        amount: String(object.totalAmount),
        month,
        year,
        status: "paid",
        isCreditCard: true,
        creditCardName: cardName,
      })
      .returning();
    expEntryId = newEntry.id;
  }

  if (object.transactions?.length > 0) {
    await db.insert(creditCardTransactions).values(
      object.transactions.map((t) => ({
        expenseEntryId: expEntryId,
        description: t.description,
        amount: String(t.amount),
        transactionDate: parseDate(t.date, year),
        merchant: null,
        aiCategory: t.category,
        aiSubcategory: null,
        aiNotes: t.notes ?? null,
        isOptimizable: t.isOptimizable ?? false,
      }))
    );
  }

  return Response.json({
    success: true,
    totalAmount: object.totalAmount,
    transactionCount: object.transactions?.length ?? 0,
    optimizationSummary: object.optimizationSummary,
    transactions: object.transactions ?? [],
    expenseEntryId: expEntryId,
  });
}
