"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { CheckCircle2, Clock, Trash2, Pencil, Plus, X, RepeatIcon } from "lucide-react";

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

function AmountCell({ entry, type, onSave }: {
  entry: Entry;
  type: "income" | "expense";
  onSave: (id: string, amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(parseFloat(entry.amount).toFixed(2).replace(".", ","));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const num = parseFloat(value.replace(",", "."));
    if (!isNaN(num) && num > 0) onSave(entry.id, num);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-28 text-right text-sm font-semibold text-zinc-800 bg-zinc-50 border border-emerald-400 rounded px-2 py-0.5 tabular-nums focus:outline-none"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Clique para editar o valor"
      className="group/val flex items-center gap-1 tabular-nums text-sm font-semibold text-zinc-800 hover:text-emerald-600 transition-colors"
    >
      {formatCurrency(entry.amount)}
      <Pencil className="h-3 w-3 opacity-0 group-hover/val:opacity-40 transition-opacity" />
    </button>
  );
}

interface NewEntry {
  description: string;
  amount: string;
  recurring: boolean;
}

export default function TransacoesPage() {
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [tab, setTab] = useState<Tab>("expenses");
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<NewEntry>({ description: "", amount: "", recurring: false });
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/dashboard?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setExpenses(d.currentMonth.expenses ?? []);
        setIncomes(d.currentMonth.incomes ?? []);
      });
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const currentType = tab === "incomes" ? "income" : "expense";

  async function toggleStatus(entry: Entry) {
    const next = entry.status === "paid" ? "estimated" : "paid";
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: next } : e));
    await fetch(`/api/transacoes/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, type: currentType }),
    });
  }

  async function updateAmount(id: string, amount: number) {
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.map((e) => e.id === id ? { ...e, amount: amount.toString() } : e));
    await fetch(`/api/transacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, type: currentType }),
    });
  }

  async function addEntry() {
    const amount = parseFloat(newEntry.amount.replace(",", "."));
    if (!newEntry.description.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    const res = await fetch("/api/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: newEntry.description.trim(),
        amount,
        month,
        year,
        type: currentType,
        recurring: newEntry.recurring,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setAdding(false);
      setNewEntry({ description: "", amount: "", recurring: false });
      load();
    }
  }

  async function remove(entry: Entry) {
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.filter((e) => e.id !== entry.id));
    await fetch(`/api/transacoes/${entry.id}?type=${currentType}`, { method: "DELETE" });
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{MONTHS[month - 1]} {year} — {tab === "expenses" ? "Despesas" : "Receitas"}</CardTitle>
          <Button
            size="sm"
            variant={adding ? "outline" : "default"}
            onClick={() => { setAdding((v) => !v); setTimeout(() => descRef.current?.focus(), 50); }}
          >
            {adding ? <><X className="h-3.5 w-3.5" /> Cancelar</> : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-100">
            {entries.length === 0 && (
              <p className="text-sm text-zinc-400 py-8 text-center">Nenhum lançamento para este mês</p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 group transition-colors">

                {/* Toggle status */}
                <button
                  onClick={() => toggleStatus(entry)}
                  title={entry.status === "paid" ? "Marcar como estimado" : "Marcar como pago"}
                  className="shrink-0 transition-transform hover:scale-110"
                >
                  {entry.status === "paid"
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    : <Clock className="h-5 w-5 text-zinc-300 hover:text-zinc-400" />}
                </button>

                {/* Descrição */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{entry.description}</p>
                  {entry.isCreditCard && entry.creditCardName && (
                    <p className="text-xs text-zinc-400">{entry.creditCardName}</p>
                  )}
                </div>

                {/* Valor editável inline */}
                <AmountCell entry={entry} type={currentType} onSave={updateAmount} />

                {/* Remover — aparece no hover */}
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

          {/* Formulário de adição inline */}
          {adding && (
            <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 space-y-3">
              <div className="flex gap-2">
                <Input
                  ref={descRef}
                  value={newEntry.description}
                  onChange={(e) => setNewEntry((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição (ex: Mercado, Academia...)"
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}
                />
                <Input
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Valor (R$)"
                  className="w-32 text-right"
                  onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newEntry.recurring}
                    onChange={(e) => setNewEntry((p) => ({ ...p, recurring: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-xs text-zinc-600 flex items-center gap-1">
                    <RepeatIcon className="h-3 w-3" />
                    Recorrente — repetir até dezembro
                  </span>
                </label>
                <Button size="sm" onClick={addEntry} disabled={saving || !newEntry.description.trim() || !newEntry.amount}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-400 text-center">
        Clique em ✓/🕐 para alternar status · Clique no valor para editar · Passe o mouse para remover
      </p>
    </div>
  );
}
