"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS, EXPENSE_CATEGORIES } from "@/lib/utils";
import { Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Transaction {
  description: string;
  amount: number;
  date?: string;
  merchant?: string;
  category: string;
  subcategory?: string;
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

export default function FaturasPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cardName, setCardName] = useState("Nubank Mu");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("cardName", cardName);
    formData.append("month", month.toString());
    formData.append("year", year.toString());

    try {
      const res = await fetch("/api/upload-fatura", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error ?? "Erro ao processar fatura");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const optimizable = result?.transactions.filter((t) => t.isOptimizable) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-900">Análise de Faturas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Subir Fatura de Cartão</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
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
                <label className="text-sm font-medium text-zinc-700 mb-1 block">Arquivo (CSV)</label>
                <input ref={fileRef} type="file" accept=".csv,.txt,.pdf" className="w-full text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" required />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>Analisando com IA...</>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Analisar Fatura
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
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
