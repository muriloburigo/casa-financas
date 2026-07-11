"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS, EXPENSE_CATEGORIES, CATEGORY_BUCKET, INVESTMENT_CATEGORY } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Wallet, Pencil, Sparkles,
  CheckCircle2, AlertTriangle, PiggyBank, Home as HomeIcon, Palette,
  ChevronDown, CreditCard,
} from "lucide-react";

interface CategorySuggestion {
  category: string;
  bucket: "fixed" | "variable";
  historicalAvg: number;
  suggestedCap: number;
  adjustment: "reduzir" | "manter" | "aumentar disponível";
}

interface BudgetSuggestion {
  avgMonthlyIncome: number;
  monthsUsed: number;
  dataCoverage: boolean;
  categories: CategorySuggestion[];
  totalFixedCap: number;
  totalVariableCap: number;
  investmentSuggested: number;
  investmentPct: number;
}

interface Narrative {
  summary: string;
  fixedRationale: string;
  variableRationale: string;
  investmentRationale: string;
  tips: string[];
}

interface SuggestionResult {
  suggestion: BudgetSuggestion;
  narrative: Narrative;
}

interface BudgetItem { description: string; amount: number; cardName?: string; }

// Lista de lançamentos que compõem uma categoria — mesmo estilo usado no dashboard
function ItemsList({ items }: { items: BudgetItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-400 py-1">Nenhum lançamento neste mês</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-1">
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
  );
}

// Célula de teto editável inline — mesmo padrão do AmountCell em transacoes/page.tsx
function CapCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value.toFixed(2).replace(".", ","));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { if (!editing) setText(value.toFixed(2).replace(".", ",")); }, [value, editing]);

  function commit() {
    const num = parseFloat(text.replace(",", "."));
    if (!isNaN(num) && num >= 0) onSave(num);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        inputMode="decimal"
        className="w-24 text-right text-base sm:text-sm font-semibold text-zinc-800 bg-zinc-50 border border-emerald-400 rounded px-2 py-1 sm:py-0.5 tabular-nums focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Toque para editar o teto"
      className="flex items-center gap-1 tabular-nums text-sm font-semibold text-zinc-800 hover:text-emerald-600 transition-colors p-1.5 -m-1.5"
    >
      {formatCurrency(value)}
      <Pencil className="h-3 w-3 opacity-40" />
    </button>
  );
}

function CategoryRow({ category, cap, actual, items, expanded, onToggle, onSaveCap }: {
  category: string; cap: number; actual: number; items: BudgetItem[];
  expanded: boolean; onToggle: () => void; onSaveCap: (v: number) => void;
}) {
  const hasCap = cap > 0;
  const pct = hasCap ? Math.min((actual / cap) * 100, 100) : 0;
  const over = hasCap && actual > cap;

  return (
    <div className="px-5 py-3 border-b border-zinc-100 last:border-0">
      {/* Div clicável (não <button>) porque contém o CapCell, que já é um botão — botão dentro de botão é HTML inválido */}
      <div onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }} className="w-full text-left cursor-pointer">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`} />
            <span className="text-sm font-medium text-zinc-800 truncate">{category}</span>
            {over && <Badge variant="over">Estourado</Badge>}
            {!hasCap && <span className="text-xs text-zinc-400">sem teto definido</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 tabular-nums hidden sm:inline">{formatCurrency(actual)} de</span>
            {/* CapCell é clicável por dentro; impede que o toggle do accordion capture o clique */}
            <span onClick={(e) => e.stopPropagation()}>
              <CapCell value={cap} onSave={onSaveCap} />
            </span>
          </div>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${over ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div className="mt-2 ml-5 border-l border-zinc-100 pl-3">
          <ItemsList items={items} />
        </div>
      )}
    </div>
  );
}

export default function OrcamentoPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);

  const [caps, setCaps] = useState<Record<string, number>>({});
  const [actual, setActual] = useState<Record<string, number>>({});
  const [actualItems, setActualItems] = useState<Record<string, BudgetItem[]>>({});
  const [income, setIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [suggestionData, setSuggestionData] = useState<{ result: SuggestionResult | null; generatedAt: string | null; generatedBy: string | null }>({ result: null, generatedAt: null, generatedBy: null });
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadBudget = useCallback(async () => {
    setLoading(true);
    const [budgetRes, dashboardRes] = await Promise.all([
      fetch(`/api/budget?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/dashboard?year=${year}&month=${month}`).then((r) => r.json()),
    ]);

    const capsMap: Record<string, number> = {};
    for (const c of budgetRes.caps ?? []) capsMap[c.category] = c.monthlyCap;
    const actualMap: Record<string, number> = {};
    const itemsMap: Record<string, BudgetItem[]> = {};
    for (const a of budgetRes.actual ?? []) {
      actualMap[a.category] = a.amount;
      itemsMap[a.category] = a.items ?? [];
    }

    setCaps(capsMap);
    setActual(actualMap);
    setActualItems(itemsMap);
    setIncome(dashboardRes.currentMonth?.totalIncome ?? 0);
    setLoading(false);
  }, [month, year]);

  const loadSuggestionCache = useCallback(async () => {
    const res = await fetch(`/api/budget/suggest?year=${year}`);
    const json = await res.json();
    setSuggestionData(json);
  }, [year]);

  useEffect(() => { loadBudget(); }, [loadBudget]);
  useEffect(() => { loadSuggestionCache(); }, [loadSuggestionCache]);

  async function saveCap(category: string, monthlyCap: number) {
    setCaps((prev) => ({ ...prev, [category]: monthlyCap }));
    await fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, caps: [{ category, monthlyCap }] }),
    });
  }

  async function generateSuggestion() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/budget/suggest?year=${year}`, { method: "POST" });
      const json = await res.json();
      setSuggestionData(json);
    } finally {
      setGenerating(false);
    }
  }

  async function applySuggestion() {
    const suggestion = suggestionData.result?.suggestion;
    if (!suggestion) return;
    setApplying(true);
    try {
      const newCaps = suggestion.categories
        .filter((c) => c.suggestedCap > 0)
        .map((c) => ({ category: c.category, monthlyCap: Math.round(c.suggestedCap * 100) / 100 }));
      if (suggestion.investmentSuggested > 0) {
        newCaps.push({ category: INVESTMENT_CATEGORY, monthlyCap: Math.round(suggestion.investmentSuggested * 100) / 100 });
      }
      await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, caps: newCaps }),
      });
      await loadBudget();
    } finally {
      setApplying(false);
    }
  }

  const fixedCategories = EXPENSE_CATEGORIES.filter((c) => CATEGORY_BUCKET[c] === "fixed");
  const variableCategories = EXPENSE_CATEGORIES.filter((c) => CATEGORY_BUCKET[c] === "variable");

  const totalFixedCap = fixedCategories.reduce((s, c) => s + (caps[c] ?? 0), 0);
  const totalFixedActual = fixedCategories.reduce((s, c) => s + (actual[c] ?? 0), 0);
  const totalVariableCap = variableCategories.reduce((s, c) => s + (caps[c] ?? 0), 0);
  const totalVariableActual = variableCategories.reduce((s, c) => s + (actual[c] ?? 0), 0);

  const totalAlocado = EXPENSE_CATEGORIES.reduce((s, c) => s + (caps[c] ?? 0), 0);
  const investmentCap = caps[INVESTMENT_CATEGORY] ?? 0;
  const investmentActual = actual[INVESTMENT_CATEGORY] ?? 0;
  const investmentShort = investmentCap > 0 && investmentActual < investmentCap;
  const saldoNaoAlocado = income - totalAlocado - investmentCap;

  const suggestion = suggestionData.result?.suggestion ?? null;
  const narrative = suggestionData.result?.narrative ?? null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Orçamento</h1>
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
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-900"
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">Carregando...</div>
      ) : (
        <>
          {/* Resumo do mês */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Renda do mês</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-bold text-zinc-800">{formatCurrency(income)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Alocado (despesas)</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-bold text-zinc-800">{formatCurrency(totalAlocado)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Meta de investimento</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-bold text-blue-600">{formatCurrency(investmentCap)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Saldo não alocado</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-lg font-bold ${saldoNaoAlocado >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(saldoNaoAlocado)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Investimento — "pague-se primeiro" */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-5">
              {/* Div clicável (não <button>) porque contém o CapCell, que já é um botão — botão dentro de botão é HTML inválido */}
              <div
                onClick={() => setExpandedCategory(expandedCategory === INVESTMENT_CATEGORY ? null : INVESTMENT_CATEGORY)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedCategory(expandedCategory === INVESTMENT_CATEGORY ? null : INVESTMENT_CATEGORY); }}
                className="w-full text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${expandedCategory === INVESTMENT_CATEGORY ? "" : "-rotate-90"}`} />
                    <PiggyBank className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-sm font-semibold text-zinc-800">Invista antes de gastar</span>
                    {investmentCap > 0 ? (
                      <Badge variant={investmentShort ? "estimated" : "paid"}>
                        {investmentShort ? "Abaixo da meta" : "Na meta"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-400">sem meta definida</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400 tabular-nums hidden sm:inline">{formatCurrency(investmentActual)} de</span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <CapCell value={investmentCap} onSave={(v) => saveCap(INVESTMENT_CATEGORY, v)} />
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${investmentShort ? "bg-amber-400" : "bg-blue-500"}`}
                    style={{ width: `${investmentCap > 0 ? Math.min((investmentActual / investmentCap) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Separe o aporte do mês antes de definir o teto das outras categorias.</p>

              {expandedCategory === INVESTMENT_CATEGORY && (
                <div className="mt-2 ml-5 border-l border-zinc-100 pl-3">
                  <ItemsList items={actualItems[INVESTMENT_CATEGORY] ?? []} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custos fixos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4 text-zinc-400" />
                Custos Fixos
              </CardTitle>
              <div className="text-right shrink-0">
                <span className={`text-sm font-semibold tabular-nums ${totalFixedCap > 0 && totalFixedActual > totalFixedCap ? "text-red-500" : "text-zinc-800"}`}>
                  {formatCurrency(totalFixedActual)}
                </span>
                <span className="text-xs text-zinc-400 tabular-nums"> de {formatCurrency(totalFixedCap)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {fixedCategories.map((category) => (
                <CategoryRow
                  key={category}
                  category={category}
                  cap={caps[category] ?? 0}
                  actual={actual[category] ?? 0}
                  items={actualItems[category] ?? []}
                  expanded={expandedCategory === category}
                  onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  onSaveCap={(v) => saveCap(category, v)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Estilo de vida */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-zinc-400" />
                Estilo de Vida
              </CardTitle>
              <div className="text-right shrink-0">
                <span className={`text-sm font-semibold tabular-nums ${totalVariableCap > 0 && totalVariableActual > totalVariableCap ? "text-red-500" : "text-zinc-800"}`}>
                  {formatCurrency(totalVariableActual)}
                </span>
                <span className="text-xs text-zinc-400 tabular-nums"> de {formatCurrency(totalVariableCap)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {variableCategories.map((category) => (
                <CategoryRow
                  key={category}
                  category={category}
                  cap={caps[category] ?? 0}
                  actual={actual[category] ?? 0}
                  items={actualItems[category] ?? []}
                  expanded={expandedCategory === category}
                  onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  onSaveCap={(v) => saveCap(category, v)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Sugestão de orçamento com IA */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Sugestão de Orçamento (IA)
                </CardTitle>
                {suggestionData.generatedAt ? (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Gerado por {suggestionData.generatedBy} em {new Date(suggestionData.generatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 mt-0.5">Baseada no histórico de receita e gastos da família</p>
                )}
              </div>
              <Button size="sm" onClick={generateSuggestion} disabled={generating}>
                <Sparkles className={`h-3.5 w-3.5 ${generating ? "animate-pulse" : ""}`} />
                {generating ? "Calculando..." : "Gerar sugestão"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!suggestion && !generating && (
                <p className="text-sm text-zinc-400 text-center py-6">
                  Clique em &quot;Gerar sugestão&quot; para calcular tetos com base no método 50% custos fixos / 30% estilo de vida / 20%+ investimento — inspirado em princípios popularizados por Thiago Nigro e Tiago Reis.
                </p>
              )}

              {suggestion && !suggestion.dataCoverage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Sugestão baseada em poucos meses de histórico ({suggestion.monthsUsed}). Cadastre mais receitas e despesas para refinar.</p>
                </div>
              )}

              {narrative && suggestion && (
                <>
                  <p className="text-sm text-zinc-700 leading-relaxed">{narrative.summary}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Custos Fixos</p>
                      <p className="text-base font-bold text-zinc-800 mt-1">{formatCurrency(suggestion.totalFixedCap)}</p>
                      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{narrative.fixedRationale}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Estilo de Vida</p>
                      <p className="text-base font-bold text-zinc-800 mt-1">{formatCurrency(suggestion.totalVariableCap)}</p>
                      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{narrative.variableRationale}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Investimento</p>
                      <p className="text-base font-bold text-blue-700 mt-1">
                        {formatCurrency(suggestion.investmentSuggested)} <span className="text-xs font-normal">({(suggestion.investmentPct * 100).toFixed(0)}%)</span>
                      </p>
                      <p className="text-xs text-blue-600/80 mt-1.5 leading-relaxed">{narrative.investmentRationale}</p>
                    </div>
                  </div>

                  {narrative.tips.length > 0 && (
                    <div className="space-y-1.5">
                      {narrative.tips.map((tip, i) => (
                        <div key={i} className="flex gap-2 text-xs text-zinc-600">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <p>{tip}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="divide-y divide-zinc-100 border-t border-zinc-100 pt-1">
                    {suggestion.categories.map((c) => (
                      <div key={c.category} className="flex items-center justify-between py-2 text-xs">
                        <span className="text-zinc-600">{c.category}</span>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-zinc-400">{formatCurrency(c.historicalAvg)} →</span>
                          <span className="font-semibold text-zinc-800">{formatCurrency(c.suggestedCap)}</span>
                          <Badge variant={c.adjustment === "reduzir" ? "over" : c.adjustment === "manter" ? "estimated" : "paid"}>
                            {c.adjustment}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={applySuggestion} disabled={applying} className="w-full sm:w-auto">
                    {applying ? "Aplicando..." : "Aplicar sugestão aos tetos"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
