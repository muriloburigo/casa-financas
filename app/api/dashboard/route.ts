import { db } from "@/lib/db";
import { expenseEntries, incomeEntries, investmentEntries, creditCardTransactions, categoryRules } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Prioridade de categoria para ordenação das despesas (menor número = aparece primeiro)
const CATEGORY_PRIORITY: Record<string, number> = {
  "Habitação":   1,
  "Mobilidade":  2,
  "Educação":    3,
  "Saúde":       4,
  "Serviços":    5,
  "Impostos":    6,
  "Lazer":       7,
  "Assinaturas": 8,
  "Alimentação": 9,
  "Vestuário":   10,
  "Outros":      20,
};

function inferCategory(description: string, rules: { pattern: string; category: string }[]): string {
  const lower = description.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.pattern.toLowerCase())) return rule.category;
  }
  return "Outros";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") ?? (new Date().getMonth() + 1).toString());

  const [expenses, incomes, investments, rules] = await Promise.all([
    db.select().from(expenseEntries).where(eq(expenseEntries.year, year)),
    db.select().from(incomeEntries).where(eq(incomeEntries.year, year)).orderBy(asc(incomeEntries.description)),
    db.select().from(investmentEntries).where(eq(investmentEntries.year, year)).orderBy(asc(investmentEntries.description)),
    db.select().from(categoryRules),
  ]);

  // Ordena despesas: categoria lógica → maior valor dentro da categoria
  expenses.sort((a, b) => {
    const catA = inferCategory(a.description, rules);
    const catB = inferCategory(b.description, rules);
    const prioA = CATEGORY_PRIORITY[catA] ?? 15;
    const prioB = CATEGORY_PRIORITY[catB] ?? 15;
    if (prioA !== prioB) return prioA - prioB;
    return parseFloat(b.amount) - parseFloat(a.amount);
  });

  // Monthly aggregates
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month: m,
      income: incomes.filter((i) => i.month === m).reduce((s, r) => s + parseFloat(r.amount), 0),
      expenses: expenses.filter((e) => e.month === m).reduce((s, r) => s + parseFloat(r.amount), 0),
    };
  });

  const currentExpenses = expenses.filter((e) => e.month === month);
  const currentIncomes = incomes.filter((i) => i.month === month);
  const currentInvestments = investments.filter((i) => i.month === month);

  const regularIncomes = currentIncomes.filter((i) => !i.isBenefit);
  const benefitIncomes = currentIncomes.filter((i) => i.isBenefit);

  const totalIncome = regularIncomes.reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalBenefits = benefitIncomes.reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalExpenses = currentExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalInvestments = currentInvestments.reduce((s, i) => s + parseFloat(i.amount), 0);

  return Response.json({
    monthlyData,
    currentMonth: {
      month,
      year,
      totalIncome,
      totalBenefits,
      totalExpenses,
      totalInvestments,
      balance: totalIncome - totalExpenses,
      expenses: currentExpenses,
      incomes: currentIncomes,
    },
  });
}
