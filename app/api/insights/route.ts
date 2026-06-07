import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, incomeEntries, creditCardTransactions, insightsCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

const insightsSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.object({
    type: z.enum(["positive", "warning", "alert"]),
    title: z.string(),
    description: z.string(),
    value: z.string().optional(),
  })),
  optimizations: z.array(z.object({
    title: z.string(),
    description: z.string(),
    potentialSaving: z.string(),
    effort: z.enum(["baixo", "médio", "alto"]),
    priority: z.enum(["alta", "média", "baixa"]),
  })),
  monthlyTrend: z.string(),
  biggestRisks: z.array(z.string()),
  positivePoints: z.array(z.string()),
});

// GET — retorna o cache sem gerar nada
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [cached] = await db.select().from(insightsCache).where(eq(insightsCache.year, year));

  if (!cached) return Response.json({ insights: null, generatedAt: null, generatedBy: null });

  return Response.json({
    insights: JSON.parse(cached.payload),
    generatedAt: cached.generatedAt,
    generatedBy: cached.generatedBy,
  });
}

// POST — gera nova análise e salva no cache
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [expenses, incomes, ccTransactions] = await Promise.all([
    db.select().from(expenseEntries).where(eq(expenseEntries.year, year)),
    db.select().from(incomeEntries).where(eq(incomeEntries.year, year)),
    db.select().from(creditCardTransactions),
  ]);

  const expenseByDesc: Record<string, number> = {};
  for (const e of expenses) {
    expenseByDesc[e.description] = (expenseByDesc[e.description] ?? 0) + parseFloat(e.amount);
  }
  const topExpenses = Object.entries(expenseByDesc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([desc, total]) => ({ desc, total }));

  const ccByCategory: Record<string, number> = {};
  for (const t of ccTransactions) {
    if (t.aiCategory) {
      ccByCategory[t.aiCategory] = (ccByCategory[t.aiCategory] ?? 0) + parseFloat(t.amount);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthlyData = months.map((m) => {
    const inc = incomes.filter((r) => r.month === m).reduce((s, r) => s + parseFloat(r.amount), 0);
    const exp = expenses.filter((r) => r.month === m).reduce((s, r) => s + parseFloat(r.amount), 0);
    return { month: m, income: inc, expenses: exp };
  });

  const totalIncome = incomes.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.amount), 0);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: insightsSchema,
    messages: [{
      role: "user",
      content: `Você é um consultor financeiro pessoal. Analise os dados de ${year} da família Burigo (Murilo e Marina, filhos Mateus e Davi, Florianópolis/SC) e gere insights práticos.

DADOS FINANCEIROS ${year}:
- Receita total: R$ ${totalIncome.toFixed(2)}
- Despesa total: R$ ${totalExpenses.toFixed(2)}
- Saldo: R$ ${(totalIncome - totalExpenses).toFixed(2)}
- Taxa de poupança: ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%

DADOS MENSAIS: ${JSON.stringify(monthlyData)}
TOP DESPESAS: ${JSON.stringify(topExpenses)}
CATEGORIAS CARTÃO: ${JSON.stringify(ccByCategory)}

Seja direto, específico, cite valores reais. Responda em português brasileiro.`,
    }],
  });

  // Upsert no cache
  const existing = await db.select().from(insightsCache).where(eq(insightsCache.year, year));
  if (existing.length > 0) {
    await db.update(insightsCache)
      .set({ payload: JSON.stringify(object), generatedAt: new Date(), generatedBy: session.user?.name ?? "usuário" })
      .where(eq(insightsCache.year, year));
  } else {
    await db.insert(insightsCache).values({
      year,
      payload: JSON.stringify(object),
      generatedBy: session.user?.name ?? "usuário",
    });
  }

  const meta = { totalIncome, totalExpenses, topExpenses };
  return Response.json({ insights: object, generatedAt: new Date(), generatedBy: session.user?.name, meta });
}
