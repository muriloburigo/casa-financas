"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS } from "@/lib/utils";
import {
  Upload, FileText, AlertTriangle, CheckCircle2, Sparkles,
  ChevronRight, CreditCard, ChevronDown, Tag, Trash2, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  transactionDate: string | null;
  aiCategory: string | null;
  isOptimizable: boolean;
  aiNotes: string | null;
}

interface Invoice {
  id: string;
  creditCardName: string;
  month: number;
  year: number;
  amount: string;
  status: string;
  transactionCount: number;
  hasDetail: boolean;
}

interface AnalysisResult {
  totalAmount: number;
  transactionCount: number;
  optimizationSummary: string;
  transactions: Array<{
    description: string;
    amount: number;
    category: string;
    isOptimizable: boolean;
    notes?: string;
  }>;
}

type Step = "form" | "ready" | "done";
type Mode = "pdf" | "text";

interface ExtractedFile {
  mode: Mode;
  preview: string;
  base64?: string;
  mimeType?: string;
  fullText?: string;
  size: number;
  name: string;
}

// Detalhe de uma fatura salva, agrupado por categoria
function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/faturas/${invoiceId}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) return <p className="text-xs text-zinc-400 px-5 py-3">Carregando...</p>;
  if (!transactions || transactions.length === 0)
    return <p className="text-xs text-zinc-400 px-5 py-3">Nenhuma transação detalhada. Analise a fatura acima.</p>;

  // Agrupa por categoria, ordenado por subtotal desc
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
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
    <div className="border-t border-zinc-100">
      {sortedCategories.map(([category, txs]) => {
        const subtotal = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
        return (
          <div key={category}>
            <div className="flex items-center justify-between px-5 py-2 bg-zinc-50 border-b border-zinc-100">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{category}</span>
              <span className="text-xs font-semibold text-zinc-600 tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {txs.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-8 py-2 border-b border-zinc-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-700 truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.transactionDate && (
                      <span className="text-xs text-zinc-300">{t.transactionDate}</span>
                    )}
                    {t.isOptimizable && (
                      <Badge variant="optimizable" className="text-xs py-0">Otimizável</Badge>
                    )}
                  </div>
                  {t.aiNotes && <p className="text-xs text-amber-600 mt-0.5">{t.aiNotes}</p>}
                </div>
                <span className="text-xs font-semibold text-zinc-700 tabular-nums shrink-0">
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function FaturasPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cardName, setCardName] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);

  const [step, setStep] = useState<Step>("form");
  const [extracted, setExtracted] = useState<ExtractedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  interface CategoryRule { id: string; pattern: string; category: string; }
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const loadInvoices = useCallback(async () => {
    const res = await fetch(`/api/upload-fatura?year=${year}`);
    const data = await res.json();
    setInvoices(data.invoices ?? []);
  }, [year]);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/category-rules");
    const data = await res.json();
    setRules(data.rules ?? []);
  }, []);

  useEffect(() => { loadInvoices(); loadRules(); }, [loadInvoices, loadRules]);

  async function addRule() {
    if (!newPattern.trim() || !newCategory.trim()) return;
    setSavingRule(true);
    const res = await fetch("/api/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: newPattern.trim(), category: newCategory.trim() }),
    });
    const data = await res.json();
    setSavingRule(false);
    if (data.rule) {
      setRules((prev) => [...prev, data.rule]);
      setNewPattern("");
      setNewCategory("");
    }
  }

  async function deleteRule(id: string) {
    await fetch("/api/category-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  // Lê o arquivo no browser com FileReader (sem round-trip ao servidor)
  function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setExtracted(null);
    setResult(null);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const reader = new FileReader();

    reader.onerror = () => {
      setError("Não foi possível ler o arquivo. Tente novamente.");
      setLoading(false);
    };

    if (isPdf) {
      reader.onload = () => {
        // Remove o prefixo "data:application/pdf;base64,"
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        setExtracted({
          mode: "pdf",
          preview: file.name,
          base64,
          mimeType: "application/pdf",
          size: file.size,
          name: file.name,
        });
        setStep("ready");
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const text = reader.result as string;
        setExtracted({
          mode: "text",
          preview: text.slice(0, 500),
          fullText: text,
          size: file.size,
          name: file.name,
        });
        setStep("ready");
        setLoading(false);
      };
      reader.readAsText(file, "utf-8");
    }
  }

  async function handleAnalyze() {
    if (!extracted) return;
    setAnalyzing(true);
    setError("");

    try {
      const res = await fetch("/api/upload-fatura", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: extracted.mode,
          base64: extracted.base64,
          mimeType: extracted.mimeType,
          fullText: extracted.fullText,
          cardName,
          month,
          year,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setStep("done");
        loadInvoices();
      } else {
        setError(data.error ?? "Erro na análise");
      }
    } catch {
      setError("Erro de conexão com a IA");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setStep("form");
    setExtracted(null);
    setResult(null);
    setError("");
    setSelectedFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Faturas com transações salvas (agrupadas por cartão)
  const invoicesWithDetail = invoices.filter((inv) => inv.hasDetail);
  const invoicesByCard: Record<string, Invoice[]> = invoicesWithDetail.reduce((acc, inv) => {
    if (!acc[inv.creditCardName!]) acc[inv.creditCardName!] = [];
    acc[inv.creditCardName!].push(inv);
    return acc;
  }, {} as Record<string, Invoice[]>);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900">Faturas de Cartão</h1>

      {/* Upload / Análise */}
      <Card>
        <CardHeader>
          <CardTitle>Analisar nova fatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Indicador de etapas */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className={step === "form" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>1. Carregar arquivo</span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === "ready" ? "text-emerald-600 font-semibold" : step === "done" ? "text-zinc-300" : "text-zinc-300"}>2. Confirmar</span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === "done" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>3. Resultado</span>
          </div>

          {step === "form" && (
            <form onSubmit={handleExtract} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Cartão</label>
                  <select
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700"
                  >
                    <option value="">Selecione o cartão...</option>
                    <option>Nubank Mu</option>
                    <option>Nubank Ma</option>
                    <option>Cartão Caixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Mês</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Arquivo (PDF ou CSV)</label>
                  {/* Input escondido — botão visível para compatibilidade mobile */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.csv"
                    className="sr-only"
                    onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-left hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className={selectedFileName ? "text-zinc-800 truncate" : "text-zinc-400"}>
                      {selectedFileName || "Toque para selecionar..."}
                    </span>
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading || !cardName || !selectedFileName}>
                {loading
                  ? <><FileText className="h-4 w-4 animate-pulse" /> Lendo arquivo...</>
                  : <><Upload className="h-4 w-4" /> Carregar arquivo</>}
              </Button>
            </form>
          )}

          {step === "ready" && extracted && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                <FileText className="h-8 w-8 text-zinc-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-700">{extracted.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(extracted.size / 1024).toFixed(0)} KB · {cardName} · {MONTHS[month - 1]} {year}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {extracted.mode === "pdf" ? "Claude vai ler o PDF diretamente" : "Arquivo de texto pronto"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>Trocar</Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing
                    ? <><Sparkles className="h-4 w-4 animate-pulse" /> Analisando...</>
                    : <><Sparkles className="h-4 w-4" /> Analisar com IA</>}
                </Button>
                {analyzing && (
                  <p className="text-xs text-zinc-400 self-center">Pode levar até 30 segundos…</p>
                )}
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-800">
                    {result.transactionCount} transações · Total {formatCurrency(result.totalAmount)}
                  </p>
                  <p className="text-sm text-zinc-600 mt-1">{result.optimizationSummary}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>Analisar outra fatura</Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Erro</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regras de categoria */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-zinc-400" />
            Regras de Categoria
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">Aplicadas automaticamente em todas as faturas futuras</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-700">
                      Se contém <span className="font-mono bg-zinc-100 px-1 rounded text-xs">{r.pattern}</span>
                      {" → "}
                      <span className="font-semibold text-emerald-700">{r.category}</span>
                    </span>
                  </div>
                  <button onClick={() => deleteRule(r.id)} className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="Trecho do nome (ex: Sesc Cacupé)"
              className="flex-1 text-sm h-9"
              onKeyDown={(e) => { if (e.key === "Enter") addRule(); }}
            />
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoria"
              className="w-36 text-sm h-9"
              onKeyDown={(e) => { if (e.key === "Enter") addRule(); }}
            />
            <Button size="sm" onClick={addRule} disabled={savingRule || !newPattern.trim() || !newCategory.trim()} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Faturas salvas */}
      {Object.keys(invoicesByCard).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Faturas Analisadas</h2>
          {Object.entries(invoicesByCard).map(([card, cardInvoices]) => (
            <Card key={card}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-zinc-400" />
                  {card}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-100">
                  {cardInvoices.sort((a, b) => b.month - a.month).map((inv) => {
                    const isExpanded = expandedId === inv.id;
                    return (
                      <div key={inv.id}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors text-left"
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                          <div className="flex-1">
                            <span className="text-sm font-medium text-zinc-800">
                              {MONTHS[inv.month - 1]} {inv.year}
                            </span>
                            <span className="text-xs text-zinc-400 ml-2">
                              {inv.transactionCount} transações
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-zinc-100 text-zinc-500"
                            }`}>
                              {inv.status === "paid" ? "Pago" : "Estimado"}
                            </span>
                            <span className="text-sm font-semibold text-zinc-800 tabular-nums">
                              {formatCurrency(inv.amount)}
                            </span>
                          </div>
                        </button>
                        {isExpanded && <InvoiceDetail invoiceId={inv.id} />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
