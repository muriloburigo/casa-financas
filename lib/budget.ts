import { db } from "@/lib/db";
import { incomeEntries, investmentEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCategoryBreakdown } from "@/lib/categories";
import { EXPENSE_CATEGORIES, CATEGORY_BUCKET } from "@/lib/utils";

// Meta de orçamento inspirada em princípios popularizados por Thiago Nigro (Primo Rico)
// e Tiago Reis (Suno): pague-se primeiro (separa investimento antes do resto), consistência
// de aportes mensais e uma divisão 50% custos fixos / 30% estilo de vida / 20%+ investimento.
const FIXED_TARGET_PCT = 0.5;
const VARIABLE_TARGET_PCT = 0.3;

function lastNMonths(n: number, from = new Date()): { month: number; year: number }[] {
  const result: { month: number; year: number }[] = [];
  let year = from.getFullYear();
  let month = from.getMonth() + 1;
  for (let i = 0; i < n; i++) {
    result.unshift({ month, year });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result;
}

export interface HistoricalAverages {
  avgMonthlyIncome: number;
  avgByCategory: Record<string, number>;
  avgInvestment: number;
  monthsUsed: number;
}

// Calcula médias mensais dos últimos `monthsBack` meses que têm receita registrada,
// atravessando virada de ano se preciso (não trava no ano civil corrente).
export async function getHistoricalAverages(monthsBack = 6): Promise<HistoricalAverages> {
  const candidates = lastNMonths(monthsBack);

  const monthlyIncomes = await Promise.all(
    candidates.map(async ({ month, year }) => {
      const rows = await db
        .select()
        .from(incomeEntries)
        .where(and(eq(incomeEntries.month, month), eq(incomeEntries.year, year)));
      const total = rows.filter((r) => !r.isBenefit).reduce((s, r) => s + parseFloat(r.amount), 0);
      return { month, year, total };
    })
  );

  const qualifying = monthlyIncomes.filter((m) => m.total > 0);
  const monthsUsed = qualifying.length;

  if (monthsUsed === 0) {
    const avgByCategory: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) avgByCategory[cat] = 0;
    return { avgMonthlyIncome: 0, avgByCategory, avgInvestment: 0, monthsUsed: 0 };
  }

  const [breakdowns, investmentTotals] = await Promise.all([
    Promise.all(qualifying.map((m) => getCategoryBreakdown(m.month, m.year))),
    Promise.all(
      qualifying.map(async ({ month, year }) => {
        const rows = await db
          .select()
          .from(investmentEntries)
          .where(and(eq(investmentEntries.month, month), eq(investmentEntries.year, year)));
        return rows.reduce((s, r) => s + parseFloat(r.amount), 0);
      })
    ),
  ]);

  const sumByCategory: Record<string, number> = {};
  for (const cat of EXPENSE_CATEGORIES) sumByCategory[cat] = 0;
  for (const breakdown of breakdowns) {
    for (const { category, amount } of breakdown) {
      if (category in sumByCategory) sumByCategory[category] += amount;
      // categorias fora da lista canônica (ex.: nome livre digitado numa regra) caem fora do orçamento
    }
  }

  const avgByCategory: Record<string, number> = {};
  for (const cat of EXPENSE_CATEGORIES) avgByCategory[cat] = sumByCategory[cat] / monthsUsed;

  const avgMonthlyIncome = qualifying.reduce((s, m) => s + m.total, 0) / monthsUsed;
  const avgInvestment = investmentTotals.reduce((s, v) => s + v, 0) / monthsUsed;

  return { avgMonthlyIncome, avgByCategory, avgInvestment, monthsUsed };
}

export interface CategorySuggestion {
  category: string;
  bucket: "fixed" | "variable";
  historicalAvg: number;
  suggestedCap: number;
  adjustment: "reduzir" | "manter" | "aumentar disponível";
}

export interface BudgetSuggestion {
  avgMonthlyIncome: number;
  monthsUsed: number;
  dataCoverage: boolean;
  categories: CategorySuggestion[];
  totalFixedCap: number;
  totalVariableCap: number;
  investmentSuggested: number;
  investmentPct: number;
}

function allocateBucket(
  bucket: "fixed" | "variable",
  target: number,
  avgByCategory: Record<string, number>
): { category: string; historicalAvg: number; suggestedCap: number }[] {
  const cats = EXPENSE_CATEGORIES.filter((c) => CATEGORY_BUCKET[c] === bucket);
  const historicalTotal = cats.reduce((s, c) => s + (avgByCategory[c] ?? 0), 0);

  return cats.map((category) => {
    const historicalAvg = avgByCategory[category] ?? 0;
    let suggestedCap: number;
    if (historicalTotal === 0) {
      suggestedCap = 0;
    } else if (historicalTotal <= target) {
      // Dentro da meta: mantém o teto próximo do histórico, não infla gasto artificialmente.
      suggestedCap = historicalAvg;
    } else {
      // Acima da meta: escala tudo proporcionalmente até caber no teto do bucket (sinaliza corte).
      suggestedCap = (historicalAvg / historicalTotal) * target;
    }
    return { category, historicalAvg, suggestedCap };
  });
}

// Sugestão determinística — a matemática nunca é decidida pela IA, só a redação em cima dela.
export function computeBudgetSuggestion(hist: HistoricalAverages): BudgetSuggestion {
  const fixedTarget = hist.avgMonthlyIncome * FIXED_TARGET_PCT;
  const variableTarget = hist.avgMonthlyIncome * VARIABLE_TARGET_PCT;

  const fixedCaps = allocateBucket("fixed", fixedTarget, hist.avgByCategory);
  const variableCaps = allocateBucket("variable", variableTarget, hist.avgByCategory);

  const totalFixedCap = fixedCaps.reduce((s, c) => s + c.suggestedCap, 0);
  const totalVariableCap = variableCaps.reduce((s, c) => s + c.suggestedCap, 0);

  // fixedCap <= 50% e variableCap <= 30% por construção, então a sobra é sempre >= 20% da renda —
  // sem precisar de piso artificial: quanto menos as categorias gastam, maior a meta de investimento.
  const investmentSuggested = hist.avgMonthlyIncome - totalFixedCap - totalVariableCap;
  const investmentPct = hist.avgMonthlyIncome > 0 ? investmentSuggested / hist.avgMonthlyIncome : 0;

  function withBucket(bucket: "fixed" | "variable", caps: { category: string; historicalAvg: number; suggestedCap: number }[]): CategorySuggestion[] {
    return caps.map((c) => ({
      ...c,
      bucket,
      adjustment:
        c.suggestedCap < c.historicalAvg * 0.95 ? "reduzir" as const
        : c.suggestedCap > c.historicalAvg * 1.05 ? "aumentar disponível" as const
        : "manter" as const,
    }));
  }

  return {
    avgMonthlyIncome: hist.avgMonthlyIncome,
    monthsUsed: hist.monthsUsed,
    dataCoverage: hist.monthsUsed >= 2,
    categories: [...withBucket("fixed", fixedCaps), ...withBucket("variable", variableCaps)],
    totalFixedCap,
    totalVariableCap,
    investmentSuggested,
    investmentPct,
  };
}
