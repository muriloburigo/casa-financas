"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS, EXPENSE_CATEGORIES } from "@/lib/utils";
import { Upload, FileText, AlertTriangle, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";

interface Transaction {
  description: string;
  amount: number;
  date?: string;
  category: string;
  isOptimizable: boolean;
  notes?: string;
}

interface UploadResult {
  success: boolean;
  totalAmount: number;
  transactionCount: number;
  optimizationSummary: string;
  transactions: Transaction[];
}

type Step = "form" | "extracted" | "done";

export default function FaturasPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cardName, setCardName] = useState("Nubank Mu");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);

  const [step, setStep] = useState<Step>("form");
  const [extractedText, setExtractedText] = useState("");
  const [charCount, setCharCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  // Etapa 1 — extrai texto do PDF
  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setExtractedText("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-fatura", { method: "POST", body: formData });
      const data = await res.json();
      if (data.extracted) {
        setExtractedText(data.extracted);
        setCharCount(data.charCount ?? data.extracted.length);
        setStep("extracted");
      } else {
        setError(data.error ?? "Erro ao extrair texto do arquivo");
      }
    } catch {
      setError("Erro de conexão ao extrair o arquivo");
    } finally {
      setLoading(false);
    }
  }

  // Etapa 2 — analisa com IA
  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");

    try {
      const res = await fetch("/api/upload-fatura", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText, cardName, month, year }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setStep("done");
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
    setExtractedText("");
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const optimizable = result?.transactions.filter((t) => t.isOptimizable) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900">Análise de Faturas</h1>

      {/* Indicador de etapas */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className={step === "form" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>1. Carregar arquivo</span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "extracted" ? "text-emerald-600 font-semibold" : step === "done" ? "text-zinc-300" : "text-zinc-300"}>2. Confirmar extração</span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "done" ? "text-emerald-600 font-semibold" : "text-zinc-300"}>3. Análise da IA</span>
      </div>

      {/* Etapa 1 — formulário */}
      {step === "form" && (
        <Card>
          <CardHeader>
            <CardTitle>Subir Fatura de Cartão</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleExtract} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Cartão</label>
                  <select
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700"
                  >
                    <option>Nubank Mu</option>
                    <option>Nubank Ma</option>
                    <option>Cartão Caixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Mês de referência</label>
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
                    accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
                    className="w-full text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <><FileText className="h-4 w-4 animate-pulse" /> Extraindo texto...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Extrair texto do arquivo</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Etapa 2 — prévia do texto extraído */}
      {step === "extracted" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Texto extraído com sucesso
              </CardTitle>
              <p className="text-xs text-zinc-400 mt-1">
                {charCount.toLocaleString()} caracteres · {cardName} · {MONTHS[month - 1]} {year}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Trocar arquivo</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="text-xs text-zinc-600 bg-zinc-50 rounded-lg p-4 max-h-48 overflow-auto whitespace-pre-wrap border border-zinc-200">
              {extractedText.slice(0, 1200)}{extractedText.length > 1200 ? "\n…(truncado para prévia)" : ""}
            </pre>
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} disabled={analyzing} className="flex-1 sm:flex-none">
                {analyzing ? (
                  <><Sparkles className="h-4 w-4 animate-pulse" /> Analisando com IA...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Analisar com IA</>
                )}
              </Button>
              <Button variant="outline" onClick={reset}>Cancelar</Button>
            </div>
            {analyzing && (
              <p className="text-xs text-zinc-400">O Claude está classificando cada transação… pode levar até 30 segundos.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Erro</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Etapa 3 — resultado */}
      {step === "done" && result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-800">
                    {result.transactionCount} transações · Total {formatCurrency(result.totalAmount)}
                  </p>
                  <p className="text-sm text-zinc-600 mt-1">{result.optimizationSummary}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
                Analisar outra fatura
              </Button>
            </CardContent>
          </Card>

          {optimizable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Oportunidades de Otimização ({optimizable.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimizable.map((t, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 py-2 border-b border-zinc-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{t.description}</p>
                        {t.notes && <p className="text-xs text-amber-600 mt-0.5">{t.notes}</p>}
                        <Badge variant="optimizable" className="mt-1">{t.category}</Badge>
                      </div>
                      <span className="text-sm font-semibold text-zinc-800 shrink-0">{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Todas as Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-zinc-100">
                {result.transactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{t.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="estimated">{t.category}</Badge>
                        {t.isOptimizable && <Badge variant="optimizable">Otimizável</Badge>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-zinc-800 shrink-0">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
