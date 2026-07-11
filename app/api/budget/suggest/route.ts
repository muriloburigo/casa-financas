import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { budgetSuggestionCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getHistoricalAverages, computeBudgetSuggestion } from "@/lib/budget";

export const maxDuration = 60;

const narrativeSchema = z.object({
  summary: z.string(),
  fixedRationale: z.string(),
  variableRationale: z.string(),
  investmentRationale: z.string(),
  tips: z.array(z.string()),
});

// GET — retorna o cache sem gerar nada
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const [cached] = await db.select().from(budgetSuggestionCache).where(eq(budgetSuggestionCache.year, year));

  if (!cached) return Response.json({ result: null, generatedAt: null, generatedBy: null });

  return Response.json({
    result: JSON.parse(cached.payload),
    generatedAt: cached.generatedAt,
    generatedBy: cached.generatedBy,
  });
}

// POST — calcula a sugestão (determinística) e pede à IA só a redação/dicas em cima dos números
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");

  const hist = await getHistoricalAverages(6);
  const suggestion = computeBudgetSuggestion(hist);

  const { object: narrative } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: narrativeSchema,
    messages: [{
      role: "user",
      content: `Você é um educador financeiro. Escreva a justificativa de uma sugestão de orçamento familiar já CALCULADA (não invente nem corrija os valores abaixo, só explique e dê dicas em cima deles) para a família Burigo (Murilo e Marina, filhos Mateus e Davi, Florianópolis/SC).

A sugestão segue uma divisão 50% custos fixos / 30% estilo de vida / 20%+ investimento, com a lógica de "pague-se primeiro" (separar o investimento antes do resto do orçamento) e constância de aportes mensais — princípios popularizados por Thiago Nigro (Primo Rico) e Tiago Reis (Suno Research). Cite essa inspiração de forma natural, sem inventar frases ou citações literais atribuídas a eles.

DADOS (baseados em ${hist.monthsUsed} meses de histórico):
- Renda média mensal: R$ ${hist.avgMonthlyIncome.toFixed(2)}
- Teto sugerido para custos fixos: R$ ${suggestion.totalFixedCap.toFixed(2)} (${hist.avgMonthlyIncome > 0 ? ((suggestion.totalFixedCap / hist.avgMonthlyIncome) * 100).toFixed(1) : 0}% da renda)
- Teto sugerido para estilo de vida: R$ ${suggestion.totalVariableCap.toFixed(2)} (${hist.avgMonthlyIncome > 0 ? ((suggestion.totalVariableCap / hist.avgMonthlyIncome) * 100).toFixed(1) : 0}% da renda)
- Meta de investimento mensal: R$ ${suggestion.investmentSuggested.toFixed(2)} (${(suggestion.investmentPct * 100).toFixed(1)}% da renda)
- Categorias e ajuste sugerido: ${JSON.stringify(suggestion.categories.map((c) => ({ categoria: c.category, historico: c.historicalAvg.toFixed(2), teto: c.suggestedCap.toFixed(2), ajuste: c.adjustment })))}

Seja direto, específico, cite valores reais em reais (R$). Responda em português brasileiro. Se ${hist.monthsUsed} for baixo (menos de 2), avise que a sugestão vai ficar mais precisa com mais meses de histórico. Não use markdown (sem **negrito**, sem #, sem listas com "-") — a interface renderiza texto puro, então escreva em frases corridas.`,
    }],
  });

  const payload = { suggestion, narrative };

  const existing = await db.select().from(budgetSuggestionCache).where(eq(budgetSuggestionCache.year, year));
  if (existing.length > 0) {
    await db.update(budgetSuggestionCache)
      .set({ payload: JSON.stringify(payload), generatedAt: new Date(), generatedBy: session.user?.name ?? "usuário" })
      .where(eq(budgetSuggestionCache.year, year));
  } else {
    await db.insert(budgetSuggestionCache).values({
      year,
      payload: JSON.stringify(payload),
      generatedBy: session.user?.name ?? "usuário",
    });
  }

  return Response.json({ result: payload, generatedAt: new Date(), generatedBy: session.user?.name });
}
