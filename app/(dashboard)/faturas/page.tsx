"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS } from "@/lib/utils";
import {
  Upload, FileText, AlertTriangle, CheckCircle2, Sparkles,
  ChevronRight, CreditCard, ChevronDown, LayoutGrid,
} from "lucide-react";

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

interface ConsolidatedTx {
  id: string;
  description: string;
  amount: number;
  cardName: string;
  transactionDate: string | null;
  isOptimizable: boolean;
  aiNotes: string | null;
}
interface ConsolidatedCategory {
  category: string;
  total: number;
  count: number;
  transactions: ConsolidatedTx[];
}

// Visão consolidada de todas as categorias do mês (todos os cartões)
function ConsolidatedRow({ month, year }: { month: number; year: number }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [data, setData] = useState<{ categories: ConsolidatedCategory[] } | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle() {
    if (!expanded && !data) {
      setLoading(true);
      fetch(`/api/faturas/month?month=${month}&year=${year}`)
        .then((r) => r.json())
        .then((d) => { setData(d); setLoading(false); });
    }
    setExpanded((e) => !e);
  }

  return (
    <div className="border-b border-zinc-100">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-violet-50 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-violet-400 shrink-0" />}
        <LayoutGrid className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        <span className="flex-1 text-sm font-medium text-violet-700">Todas as categorias</span>
        <span className="text-xs text-zinc-400">consolidado</span>
      </button>

      {expanded && (
        loading ? (
          <p className="text-xs text-zinc-400 px-8 py-3">Carregando...</p>
        ) : data && (
          <div className="border-t border-violet-100">
            {data.categories.map(({ category, total, transactions }) => {
              const isCatExpanded = expandedCat === category;
              return (
                <div key={category}>
                  {/* Cabeçalho da categoria — clicável */}
                  <button
                    onClick={() => setExpandedCat(isCatExpanded ? null : category)}
                    className="w-full flex items-center gap-2 px-5 py-2.5 bg-violet-50/60 hover:bg-violet-50 border-b border-violet-100 transition-colors text-left"
                  >
                    {isCatExpanded
                      ? <ChevronDown className="h-3 w-3 text-violet-400 shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-violet-400 shrink-0" />}
                    <span className="flex-1 text-xs font-semibold text-zinc-600 uppercase tracking-wide">{category}</span>
                    <span className="text-xs text-zinc-400 mr-3">{transactions.length} itens</span>
                    <span className="text-xs font-semibold text-zinc-700 tabular-nums">{formatCurrency(total)}</span>
                  </button>

                  {/* Transações da categoria */}
                  {isCatExpanded && transactions.map((tx) => (
                    <div key={tx.id} className="flex items-start gap-3 px-8 py-2 bg-white border-b border-violet-50 last:border-zinc-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700 truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-zinc-400">{tx.cardName}</span>
                          {tx.transactionDate && (
                            <span className="text-xs text-zinc-300">{tx.transactionDate}</span>
                          )}
                          {tx.isOptimizable && (
                            <Badge variant="optimizable" className="text-xs py-0">Otimizável</Badge>
                          )}
                        </div>
                        {tx.aiNotes && <p className="text-xs text-amber-600 mt-0.5">{tx.aiNotes}</p>}
                      </div>
                      <span className="text-xs font-semibold text-zinc-700 tabular-nums shrink-0">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )
      )}
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
  const [pdfPassword, setPdfPassword] = useState("");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    const res = await fetch(`/api/upload-fatura?year=${year}`);
    const data = await res.json();
    setInvoices(data.invoices ?? []);
  }, [year]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setExtracted(null);
    setResult(null);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

    try {
      if (isPdf) {
        // Lê os bytes do arquivo
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
        );

        // Carrega PDF.js dinamicamente com worker via blob URL (evita problemas de bundling)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib: any = await import("pdfjs-dist");
        const workerResp = await fetch("/pdf.worker.min.mjs");
        const workerBlob = await workerResp.blob();
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

        // Mantém os bytes como Uint8Array; usa .slice() em cada chamada para evitar detached ArrayBuffer
        const rawBytes = new Uint8Array(arrayBuffer);

        // Testa se o PDF está criptografado
        let encrypted = false;
        try {
          await pdfjsLib.getDocument({ data: rawBytes.slice() }).promise;
        } catch (testErr: unknown) {
          const name = (testErr as { name?: string })?.name;
          const code = (testErr as { code?: number })?.code;
          // PasswordException (code 1 = needs password, code 2 = wrong password)
          if (name === "PasswordException" || code === 1 || code === 2) {
            encrypted = true;
          } else {
            throw testErr;
          }
        }

        if (!encrypted) {
          setExtracted({ mode: "pdf", preview: file.name, base64, mimeType: "application/pdf", size: file.size, name: file.name });
          setStep("ready");
          return;
        }

        // PDF criptografado — extrai texto com a senha
        const pwd = pdfPassword.trim();
        if (!pwd) {
          setError("Este PDF está protegido por senha. Preencha o campo 'Senha do PDF'.");
          return;
        }

        const doc = await pdfjsLib.getDocument({ data: rawBytes.slice(), password: pwd }).promise;
        let text = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text += content.items.map((item: any) => item.str ?? "").join(" ") + "\n";
        }

        if (!text.trim()) throw new Error("Nenhum texto extraído do PDF. O arquivo pode ser uma imagem escaneada.");
        setExtracted({ mode: "text", preview: text.slice(0, 500), fullText: text.trim(), size: file.size, name: file.name });
        setStep("ready");

      } else {
        // CSV / texto
        const text = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsText(file, "utf-8");
        });
        setExtracted({ mode: "text", preview: text.slice(0, 500), fullText: text, size: file.size, name: file.name });
        setStep("ready");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao ler o arquivo: ${msg.slice(0, 300)}`);
    } finally {
      setLoading(false);
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
    setPdfPassword("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Agrupa por mês (somente faturas com detalhe)
  const invoicesWithDetail = invoices.filter((inv) => inv.hasDetail);
  const invoicesByMonth: Record<string, Invoice[]> = {};
  for (const inv of invoicesWithDetail) {
    const key = `${inv.year}-${String(inv.month).padStart(2, "0")}`;
    if (!invoicesByMonth[key]) invoicesByMonth[key] = [];
    invoicesByMonth[key].push(inv);
  }
  const sortedMonthKeys = Object.keys(invoicesByMonth).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900">Faturas de Cartão</h1>

      {/* Upload / Análise */}
      <Card>
        <CardHeader>
          <CardTitle>Analisar nova fatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className={step === "form" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>1. Carregar arquivo</span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === "ready" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>2. Confirmar</span>
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
              {/* Senha do PDF — aparece quando um arquivo PDF é selecionado */}
              {selectedFileName.toLowerCase().endsWith(".pdf") && (
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">
                    Senha do PDF <span className="text-zinc-400 font-normal">(se protegido)</span>
                  </label>
                  <input
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="Deixe em branco se não tiver senha"
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 placeholder:text-zinc-400"
                  />
                </div>
              )}
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

      {/* Faturas salvas — agrupadas por mês */}
      {sortedMonthKeys.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Faturas Analisadas</h2>

          {sortedMonthKeys.map((monthKey) => {
            const [yearStr, monthStr] = monthKey.split("-");
            const m = parseInt(monthStr);
            const y = parseInt(yearStr);
            const monthInvoices = invoicesByMonth[monthKey].sort((a, b) =>
              (a.creditCardName ?? "").localeCompare(b.creditCardName ?? "")
            );
            const monthTotal = monthInvoices.reduce((s, inv) => s + parseFloat(inv.amount), 0);

            return (
              <Card key={monthKey}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{MONTHS[m - 1]} {y}</CardTitle>
                    <span className="text-base font-bold text-zinc-800 tabular-nums">
                      {formatCurrency(monthTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {monthInvoices.length} cartão{monthInvoices.length !== 1 ? "ões" : ""}
                    {" · "}
                    {monthInvoices.reduce((s, i) => s + i.transactionCount, 0)} transações
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Linha consolidada de categorias */}
                  <ConsolidatedRow month={m} year={y} />

                  {/* Por cartão */}
                  <div className="divide-y divide-zinc-100">
                    {monthInvoices.map((inv) => {
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
                            <CreditCard className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-zinc-800">
                                {inv.creditCardName}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
