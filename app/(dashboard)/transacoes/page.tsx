"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { CheckCircle2, Clock, Plus } from "lucide-react";

interface Entry {
  id: string;
  description: string;
  amount: string;
  month: number;
  year: number;
  status: string;
  isCreditCard?: boolean;
  creditCardName?: string | null;
}

export default function TransacoesPage() {
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [activeTab, setActiveTab] = useState<"expenses" | "incomes">("expenses");

  useEffect(() => {
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setExpenses(d.currentMonth.expenses ?? []);
        setIncomes(d.currentMonth.incomes ?? []);
      });
  }, [month, year]);

  const entries = activeTab === "expenses" ? expenses : incomes;
  const totalPaid = entries.filter((e) => e.status === "paid").reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalEstimated = entries.filter((e) => e.status === "estimated").reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Transações</h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} {year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "expenses" ? "bg-red-100 text-red-700" : "text-zinc-600 hover:bg-zinc-100"}`}
        >
          Despesas
        </button>
        <button
          onClick={() => setActiveTab("incomes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "incomes" ? "bg-emerald-100 text-emerald-700" : "text-zinc-600 hover:bg-zinc-100"}`}
        >
          Receitas
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Pago</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-zinc-400" /> Estimado</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-zinc-500">{formatCurrency(totalEstimated)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{MONTHS[month - 1]} {year} — {activeTab === "expenses" ? "Despesas" : "Receitas"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-100">
            {entries.length === 0 && (
              <p className="text-sm text-zinc-400 py-6 text-center">Nenhum lançamento para este mês</p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {entry.status === "paid" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-zinc-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{entry.description}</p>
                    {entry.isCreditCard && entry.creditCardName && (
                      <p className="text-xs text-zinc-400">{entry.creditCardName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={entry.status === "paid" ? "paid" : "estimated"}>
                    {entry.status === "paid" ? "Pago" : "Estimado"}
                  </Badge>
                  <span className="text-sm font-semibold text-zinc-800 tabular-nums">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-400 text-center">
        Use o <a href="/chat" className="text-emerald-600 hover:underline">Assistente IA</a> para adicionar novos lançamentos
      </p>
    </div>
  );
}
