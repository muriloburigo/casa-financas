"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { ExpenseTable } from "@/components/dashboard/expense-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown, CreditCard } from "lucide-react";

const BAR_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
  "bg-teal-500", "bg-pink-500",
];

interface CategoryEntryItem { description: string; amount: number; cardName?: string; }
interface CategoryItem { category: string; amount: number; percentage: number; items: CategoryEntryItem[]; }

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
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then(setData);
    fetch(`/api/dashboard/categories?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
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
            onClick={() => { if (month > 1) { setMonth(month - 1); setExpandedCategory(null); } }}
            disabled={month === 1}
            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-600" />
          </button>
          <select
            value={month}
            onChange={(e) => { setMonth(parseInt(e.target.value)); setExpandedCategory(null); }}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} {year}</option>
            ))}
          </select>
          <button
            onClick={() => { if (month < 12) { setMonth(month + 1); setExpandedCategory(null); } }}
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

      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria — {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categories.map(({ category, amount, percentage, items }, i) => {
                const isExpanded = expandedCategory === category;
                return (
                  <div key={category}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-sm text-zinc-700 font-medium">
                          <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                          {category}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-400 tabular-nums w-10 text-right">
                            {percentage.toFixed(0)}%
                          </span>
                          <span className="text-sm font-semibold text-zinc-800 tabular-nums w-24 text-right">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 ml-5 space-y-1 border-l border-zinc-100 pl-3">
                        {items.length === 0 && (
                          <p className="text-xs text-zinc-400 py-1">Nenhum lançamento detalhado</p>
                        )}
                        {items.map((item, j) => (
                          <div key={j} className="flex items-center justify-between gap-3 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.cardName && <CreditCard className="h-3 w-3 text-zinc-300 shrink-0" />}
                              <span className="text-xs text-zinc-600 truncate">{item.description}</span>
                              {item.cardName && <span className="text-xs text-zinc-300 shrink-0">· {item.cardName}</span>}
                            </div>
                            <span className="text-xs font-medium text-zinc-700 tabular-nums shrink-0">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
