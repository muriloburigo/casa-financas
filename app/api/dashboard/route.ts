import { db } from "@/lib/db";
import { expenseEntries, incomeEntries, investmentEntries, creditCardTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") ?? (new Date().getMonth() + 1).toString());

  const [expenses, incomes, investments] = await Promise.all([
    db.select().from(expenseEntries).where(eq(expenseEntries.year, year)),
    db.select().from(incomeEntries).where(eq(incomeEntries.year, year)),
    db.select().from(investmentEntries).where(eq(investmentEntries.year, year)),
  ]);

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
