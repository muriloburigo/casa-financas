"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { CheckCircle2, Clock, Trash2 } from "lucide-react";

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

type Tab = "expenses" | "incomes";

export default function TransacoesPage() {
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [tab, setTab] = useState<Tab>("expenses");

  const load = useCallback(() => {
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setExpenses(d.currentMonth.expenses ?? []);
        setIncomes(d.currentMonth.incomes ?? []);
      });
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(entry: Entry) {
    const next = entry.status === "paid" ? "estimated" : "paid";
    const type = tab === "incomes" ? "income" : "expense";

    // Optimistic update
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: next } : e));

    await fetch(`/api/transacoes/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, type }),
    });
  }

  async function remove(entry: Entry) {
    const type = tab === "incomes" ? "income" : "expense";

    // Optimistic update
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.filter((e) => e.id !== entry.id));

    await fetch(`/api/transacoes/${entry.id}?type=${type}`, { method: "DELETE" });
  }

  const entries = tab === "expenses" ? expenses : incomes;
  const totalPaid = entries.filter((e) => e.status === "paid").reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalEstimated = entries.filter((e) => e.status === "estimated").reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Transações</h1>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-900"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m} {year}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        {(["expenses", "incomes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? t === "expenses" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {t === "expenses" ? "Despesas" : "Receitas"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-zinc-400" /> Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-zinc-400">{formatCurrency(totalEstimated)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{MONTHS[month - 1]} {year} — {tab === "expenses" ? "Despesas" : "Receitas"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-100">
            {entries.length === 0 && (
              <p className="text-sm text-zinc-400 py-8 text-center">Nenhum lançamento para este mês</p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 group transition-colors">
                {/* Toggle status — clique no ícone */}
                <button
                  onClick={() => toggleStatus(entry)}
                  title={entry.status === "paid" ? "Marcar como estimado" : "Marcar como pago"}
                  className="shrink-0 transition-transform hover:scale-110"
                >
                  {entry.status === "paid" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-zinc-300 hover:text-zinc-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{entry.description}</p>
                  {entry.isCreditCard && entry.creditCardName && (
                    <p className="text-xs text-zinc-400">{entry.creditCardName}</p>
                  )}
                </div>

                <span className="text-sm font-semibold text-zinc-800 tabular-nums shrink-0">
                  {formatCurrency(entry.amount)}
                </span>

                {/* Remover — visível apenas no hover */}
                <button
                  onClick={() => remove(entry)}
                  title="Remover"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
