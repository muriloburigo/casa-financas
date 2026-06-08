"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { ExpenseTable } from "@/components/dashboard/expense-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MONTHS } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DashboardData {
  monthlyData: Array<{ month: number; income: number; expenses: number }>;
  currentMonth: {
    month: number;
    year: number;
    totalIncome: number;
    totalBenefits: number;
    totalExpenses: number;
    totalInvestments: number;
    balance: number;
    expenses: Array<{ id: string; description: string; amount: string; month: number; year: number; status: string; isCreditCard: boolean; creditCardName: string | null }>;
    incomes: Array<{ id: string; description: string; amount: string; month: number; year: number; status: string; isBenefit: boolean }>;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);

  useEffect(() => {
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then(setData);
  }, [month, year]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-400 text-sm">Carregando...</div>
      </div>
    );
  }

  const { currentMonth, monthlyData } = data;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Dashboard</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (month > 1) setMonth(month - 1); }}
            disabled={month === 1}
            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-600" />
          </button>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} {year}</option>
            ))}
          </select>
          <button
            onClick={() => { if (month < 12) setMonth(month + 1); }}
            disabled={month === 12}
            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      </div>

      <SummaryCards
        totalIncome={currentMonth.totalIncome}
        totalBenefits={currentMonth.totalBenefits}
        totalExpenses={currentMonth.totalExpenses}
        totalInvestments={currentMonth.totalInvestments}
        balance={currentMonth.balance}
      />

      <Card>
        <CardHeader>
          <CardTitle>Receitas vs Despesas — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={monthlyData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receitas — {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseTable entries={currentMonth.incomes} title="" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Despesas — {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseTable entries={currentMonth.expenses} title="" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
