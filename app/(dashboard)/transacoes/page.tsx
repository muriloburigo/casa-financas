"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS } from "@/lib/utils";
import {
  CheckCircle2, Clock, Trash2, Pencil, Plus, X,
  RepeatIcon, ChevronDown, ChevronRight, CreditCard,
  ChevronLeft, Gift,
} from "lucide-react";

interface Entry {
  id: string;
  description: string;
  amount: string;
  month: number;
  year: number;
  status: string;
  isCreditCard?: boolean;
  creditCardName?: string | null;
  isBenefit?: boolean;
}

interface CCTransaction {
  id: string;
  description: string;
  amount: string;
  transactionDate: string | null;
  merchant: string | null;
  aiCategory: string | null;
  isOptimizable: boolean;
  aiNotes: string | null;
}

type Tab = "expenses" | "incomes";

interface NewEntry {
  description: string;
  amount: string;
  recurring: boolean;
  isBenefit: boolean;
}

// Célula de valor editável inline
function AmountCell({ entry, type, onSave }: {
  entry: Entry;
  type: "income" | "expense";
  onSave: (id: string, amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(parseFloat(entry.amount).toFixed(2).replace(".", ","));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

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
        inputMode="decimal"
        className="w-24 sm:w-28 text-right text-base sm:text-sm font-semibold text-zinc-800 bg-zinc-50 border border-emerald-400 rounded px-2 py-1 sm:py-0.5 tabular-nums focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Clique para editar"
      className="group/val flex items-center gap-1 tabular-nums text-sm font-semibold text-zinc-800 hover:text-emerald-600 transition-colors p-1.5 -m-1.5"
    >
      {formatCurrency(entry.amount)}
      <Pencil className="h-3 w-3 opacity-40 sm:opacity-0 sm:group-hover/val:opacity-40 transition-opacity" />
    </button>
  );
}

// Detalhe de transações do cartão — agrupado por categoria
function CCDetail({ entryId }: { entryId: string }) {
  const [transactions, setTransactions] = useState<CCTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/faturas/${entryId}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, [entryId]);

  if (loading) return <div className="px-14 py-3 text-xs text-zinc-400">Carregando transações...</div>;
  if (!transactions || transactions.length === 0)
    return <div className="px-14 py-3 text-xs text-zinc-400">Nenhuma transação detalhada. Suba a fatura em Análise de Faturas.</div>;

  // Agrupa por categoria
  const grouped = transactions.reduce<Record<string, CCTransaction[]>>((acc, t) => {
    const cat = t.aiCategory ?? "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const sortedCategories = Object.entries(grouped).sort(
    (a, b) =>
      b[1].reduce((s, t) => s + parseFloat(t.amount), 0) -
      a[1].reduce((s, t) => s + parseFloat(t.amount), 0)
  );

  return (
    <div className="bg-zinc-50 border-t border-zinc-100">
      {sortedCategories.map(([category, txs]) => {
        const subtotal = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
        const hasOptimizable = txs.some((t) => t.isOptimizable);
        return (
          <div key={category} className="flex items-center justify-between px-14 py-2 border-b border-zinc-100 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">{category}</span>
              {hasOptimizable && <Badge variant="optimizable" className="text-xs py-0">Otimizável</Badge>}
            </div>
            <span className="text-xs font-semibold text-zinc-700 tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TransacoesPage() {
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [tab, setTab] = useState<Tab>("expenses");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<NewEntry>({ description: "", amount: "", recurring: false, isBenefit: false });
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

  async function toggleBenefit(entry: Entry) {
    const next = !entry.isBenefit;
    setIncomes((prev) => prev.map((e) => e.id === entry.id ? { ...e, isBenefit: next } : e));
    await fetch(`/api/transacoes/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBenefit: next, type: "income" }),
    });
  }

  async function remove(entry: Entry) {
    const setter = tab === "incomes" ? setIncomes : setExpenses;
    setter((prev) => prev.filter((e) => e.id !== entry.id));
    await fetch(`/api/transacoes/${entry.id}?type=${currentType}`, { method: "DELETE" });
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
        isBenefit: tab === "incomes" ? newEntry.isBenefit : false,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setAdding(false);
      setNewEntry({ description: "", amount: "", recurring: false, isBenefit: false });
      load();
    }
  }

  const entries = tab === "expenses" ? expenses : incomes;
  const regularEntries = tab === "incomes" ? entries.filter((e) => !e.isBenefit) : entries;
  const benefitEntries = tab === "incomes" ? entries.filter((e) => e.isBenefit) : [];
  const totalPaid = regularEntries.filter((e) => e.status === "paid").reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalEstimated = regularEntries.filter((e) => e.status === "estimated").reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Transações</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (month > 1) { setMonth(month - 1); setExpandedId(null); } }}
            disabled={month === 1}
            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-600" />
          </button>
          <select
            value={month}
            onChange={(e) => { setMonth(parseInt(e.target.value)); setExpandedId(null); }}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-900"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} {year}</option>
            ))}
          </select>
          <button
            onClick={() => { if (month < 12) { setMonth(month + 1); setExpandedId(null); } }}
            disabled={month === 12}
            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["expenses", "incomes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpandedId(null); }}
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
            {adding
              ? <><X className="h-3.5 w-3.5" /> Cancelar</>
              : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-100">
            {entries.length === 0 && (
              <p className="text-sm text-zinc-400 py-8 text-center">Nenhum lançamento para este mês</p>
            )}
            {regularEntries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id}>
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 group transition-colors">
                    {/* Toggle status */}
                    <button
                      onClick={() => toggleStatus(entry)}
                      title={entry.status === "paid" ? "Marcar como estimado" : "Marcar como pago"}
                      className="shrink-0 transition-transform hover:scale-110 p-1.5 -m-1.5"
                    >
                      {entry.status === "paid"
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <Clock className="h-5 w-5 text-zinc-300 hover:text-zinc-400" />}
                    </button>

                    {/* Expandir cartão de crédito */}
                    {entry.isCreditCard
                      ? (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left"
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                          <CreditCard className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-zinc-800">{entry.description}</span>
                          <span className="hidden sm:inline text-xs text-zinc-400 shrink-0">ver detalhes</span>
                        </button>
                      )
                      : (
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{entry.description}</p>
                        </div>
                      )}

                    {/* Valor editável */}
                    <AmountCell entry={entry} type={currentType} onSave={updateAmount} />

                    {/* Marcar como benefício (só receitas) */}
                    {tab === "incomes" && (
                      <button
                        onClick={() => toggleBenefit(entry)}
                        title="Marcar como benefício (iFood, vale)"
                        className="shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-amber-400 p-1.5 -m-1.5"
                      >
                        <Gift className="h-4 w-4" />
                      </button>
                    )}

                    {/* Remover */}
                    <button
                      onClick={() => remove(entry)}
                      title="Remover"
                      className="shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400 p-1.5 -m-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Detalhe das transações do cartão */}
                  {entry.isCreditCard && isExpanded && (
                    <CCDetail entryId={entry.id} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Seção de benefícios (só em receitas) */}
          {benefitEntries.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-t border-amber-100">
                <Gift className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Benefícios</span>
                <span className="text-xs text-amber-500 ml-auto">não entram no saldo livre</span>
              </div>
              {benefitEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-amber-50/50 group transition-colors bg-amber-50/20">
                  <button onClick={() => toggleStatus(entry)} className="shrink-0 transition-transform hover:scale-110">
                    {entry.status === "paid"
                      ? <CheckCircle2 className="h-5 w-5 text-amber-400" />
                      : <Clock className="h-5 w-5 text-zinc-300 hover:text-zinc-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 truncate">{entry.description}</p>
                  </div>
                  <AmountCell entry={entry} type="income" onSave={updateAmount} />
                  <button
                    onClick={() => toggleBenefit(entry)}
                    title="Remover de benefícios"
                    className="shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 -m-1.5"
                  >
                    <Gift className="h-4 w-4 text-amber-400 hover:text-zinc-400" />
                  </button>
                  <button
                    onClick={() => remove(entry)}
                    className="shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400 p-1.5 -m-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Formulário de adição inline */}
          {adding && (
            <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
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
                  inputMode="decimal"
                  className="sm:w-32 text-right"
                  onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newEntry.recurring}
                      onChange={(e) => setNewEntry((p) => ({ ...p, recurring: e.target.checked }))}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-xs text-zinc-600 flex items-center gap-1">
                      <RepeatIcon className="h-3 w-3" />
                      Recorrente até dezembro
                    </span>
                  </label>
                  {tab === "incomes" && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newEntry.isBenefit}
                        onChange={(e) => setNewEntry((p) => ({ ...p, isBenefit: e.target.checked }))}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span className="text-xs text-zinc-600 flex items-center gap-1">
                        <Gift className="h-3 w-3 text-amber-500" />
                        Benefício (iFood, vale)
                      </span>
                    </label>
                  )}
                </div>
                <Button size="sm" className="w-full sm:w-auto" onClick={addEntry} disabled={saving || !newEntry.description.trim() || !newEntry.amount}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-400 text-center">
        Toque em ✓/🕐 para alternar status · Toque no valor para editar · Use o ícone de lixeira para remover
      </p>
    </div>
  );
}
