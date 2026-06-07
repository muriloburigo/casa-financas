"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Lightbulb, RefreshCw, Zap, ArrowRight, ShieldAlert,
} from "lucide-react";

interface Highlight {
  type: "positive" | "warning" | "alert";
  title: string;
  description: string;
  value?: string;
}

interface Optimization {
  title: string;
  description: string;
  potentialSaving: string;
  effort: "baixo" | "médio" | "alto";
  priority: "alta" | "média" | "baixa";
}

interface Insights {
  summary: string;
  highlights: Highlight[];
  optimizations: Optimization[];
  monthlyTrend: string;
  biggestRisks: string[];
  positivePoints: string[];
}

interface InsightsData {
  insights: Insights;
  meta: {
    totalIncome: number;
    totalExpenses: number;
    paidIncome: number;
    paidExpenses: number;
    topExpenses: Array<{ desc: string; total: number }>;
  };
}

const highlightIcon = {
  positive: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
  alert: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
};

const highlightBg = {
  positive: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
  alert: "bg-red-50 border-red-200",
};

const effortColor = {
  baixo: "text-emerald-600 bg-emerald-50",
  médio: "text-amber-600 bg-amber-50",
  alto: "text-red-600 bg-red-50",
};

const priorityDot = {
  alta: "bg-red-400",
  média: "bg-amber-400",
  baixa: "bg-zinc-300",
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [year] = useState(2026);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/insights?year=${year}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const savingsRate = data
    ? (((data.meta.totalIncome - data.meta.totalExpenses) / data.meta.totalIncome) * 100).toFixed(1)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Insights {year}</h1>
          <p className="text-sm text-zinc-500">Análise inteligente da sua situação financeira</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} size="sm">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analisando..." : "Atualizar"}
        </Button>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
          <Zap className="h-8 w-8 animate-pulse text-emerald-500" />
          <p className="text-sm">Claude está analisando seus dados financeiros...</p>
        </div>
      )}

      {data && (
        <>
          {/* Resumo executivo */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-700 leading-relaxed">{data.insights.summary}</p>
              <div className="flex gap-6 mt-4 pt-4 border-t border-zinc-100">
                <div>
                  <p className="text-xs text-zinc-400">Receita Total</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(data.meta.totalIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Despesa Total</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(data.meta.totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Saldo</p>
                  <p className={`text-lg font-bold ${data.meta.totalIncome - data.meta.totalExpenses >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(data.meta.totalIncome - data.meta.totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Taxa de Poupança</p>
                  <p className="text-lg font-bold text-blue-600">{savingsRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destaques */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Destaques</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.insights.highlights.map((h, i) => (
                <div key={i} className={`flex gap-3 p-4 rounded-xl border ${highlightBg[h.type]}`}>
                  {highlightIcon[h.type]}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800">{h.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{h.description}</p>
                    {h.value && <p className="text-sm font-bold text-zinc-800 mt-1">{h.value}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Oportunidades de otimização */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Oportunidades de Otimização
            </h2>
            <div className="space-y-3">
              {data.insights.optimizations.map((o, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityDot[o.priority]}`} />
                        <div>
                          <p className="text-sm font-semibold text-zinc-800">{o.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{o.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${effortColor[o.effort]}`}>
                              Esforço {o.effort}
                            </span>
                            <span className="text-xs text-zinc-400">Prioridade {o.priority}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-400">Economia potencial</p>
                        <p className="text-sm font-bold text-emerald-600">{o.potentialSaving}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Riscos */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                Principais Riscos
              </h2>
              <div className="space-y-2">
                {data.insights.biggestRisks.map((r, i) => (
                  <div key={i} className="flex gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                    <ArrowRight className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-700 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pontos positivos */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Pontos Positivos
              </h2>
              <div className="space-y-2">
                {data.insights.positivePoints.map((p, i) => (
                  <div key={i} className="flex gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-700 leading-relaxed">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tendência mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-zinc-400" />
                Tendência Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 leading-relaxed">{data.insights.monthlyTrend}</p>
            </CardContent>
          </Card>

          {/* Top despesas */}
          <Card>
            <CardHeader>
              <CardTitle>Maiores Despesas do Ano</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100">
                {data.meta.topExpenses.slice(0, 8).map((e, i) => {
                  const pct = data.meta.totalExpenses > 0 ? (e.total / data.meta.totalExpenses * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs text-zinc-400 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{e.desc}</p>
                        <div className="mt-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-zinc-800">{formatCurrency(e.total)}</p>
                        <p className="text-xs text-zinc-400">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
