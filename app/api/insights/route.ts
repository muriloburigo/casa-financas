import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, incomeEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [expenses, incomes, ccTransactions] = await Promise.all([
    db.select().from(expenseEntries).where(eq(expenseEntries.year, year)),
    db.select().from(incomeEntries).where(eq(incomeEntries.year, year)),
    db.select().from(creditCardTransactions),
  ]);

  // Aggregate by month
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthlyData = months.map((m) => {
    const inc = incomes.filter((r) => r.month === m).reduce((s, r) => s + parseFloat(r.amount), 0);
    const exp = expenses.filter((r) => r.month === m).reduce((s, r) => s + parseFloat(r.amount), 0);
    return { month: m, income: inc, expenses: exp, balance: inc - exp };
  });

  // Top expenses aggregated by description
  const expenseByDesc: Record<string, number> = {};
  for (const e of expenses) {
    expenseByDesc[e.description] = (expenseByDesc[e.description] ?? 0) + parseFloat(e.amount);
  }
  const topExpenses = Object.entries(expenseByDesc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([desc, total]) => ({ desc, total }));

  // Credit card category breakdown
  const ccByCategory: Record<string, number> = {};
  for (const t of ccTransactions) {
    if (t.aiCategory) {
      ccByCategory[t.aiCategory] = (ccByCategory[t.aiCategory] ?? 0) + parseFloat(t.amount);
    }
  }

  const totalIncome = incomes.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.amount), 0);
  const paidIncome = incomes.filter((r) => r.status === "paid").reduce((s, r) => s + parseFloat(r.amount), 0);
  const paidExpenses = expenses.filter((r) => r.status === "paid").reduce((s, r) => s + parseFloat(r.amount), 0);

  const dataForAI = {
    year,
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    paidIncome,
    paidExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : "0",
    monthlyData,
    topExpenses,
    creditCardCategories: ccByCategory,
    fixedExpenses: ["Financiamento", "Escola", "Seguro de vida", "Condomínio", "Celesc", "Internet + Celular Mu", "Celular Má / Mateus"],
  };

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: z.object({
      summary: z.string().describe("Análise executiva em 3-4 frases sobre a saúde financeira da família"),
      highlights: z.array(z.object({
        type: z.enum(["positive", "warning", "alert"]),
        title: z.string(),
        description: z.string(),
        value: z.string().optional(),
      })).describe("3-5 destaques mais importantes"),
      optimizations: z.array(z.object({
        title: z.string(),
        description: z.string(),
        potentialSaving: z.string().describe("Economia mensal ou anual estimada"),
        effort: z.enum(["baixo", "médio", "alto"]).describe("Nível de esforço para implementar"),
        priority: z.enum(["alta", "média", "baixa"]),
      })).describe("3-6 oportunidades concretas de otimização"),
      monthlyTrend: z.string().describe("Análise da tendência mensal de gastos vs receitas"),
      biggestRisks: z.array(z.string()).describe("2-3 principais riscos financeiros identificados"),
      positivePoints: z.array(z.string()).describe("2-3 pontos positivos da gestão financeira"),
    }),
    messages: [{
      role: "user",
      content: `Você é um consultor financeiro pessoal. Analise os dados financeiros anuais de ${year} da família Burigo (Murilo e Marina, dois filhos: Mateus e Davi, em Florianópolis/SC) e gere insights práticos e acionáveis.

DADOS FINANCEIROS ${year}:
${JSON.stringify(dataForAI, null, 2)}

Seja direto, específico e use os dados reais. Cite valores quando relevante. Identifique padrões, riscos e oportunidades reais com base nos números.
Responda em português brasileiro.`,
    }],
  });

  return Response.json({ insights: object, meta: { totalIncome, totalExpenses, paidIncome, paidExpenses, topExpenses } });
}
