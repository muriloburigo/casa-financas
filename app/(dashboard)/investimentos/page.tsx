"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { PiggyBank } from "lucide-react";

interface InvestmentEntry {
  id: string;
  description: string;
  amount: string;
  month: number;
  year: number;
  status: string;
}

export default function InvestimentosPage() {
  const [investments, setInvestments] = useState<InvestmentEntry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(2026);

  useEffect(() => {
    fetch(`/api/investimentos?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => setInvestments(d.investments ?? []));
  }, [month, year]);

  const total = investments.reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Investimentos</h1>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-blue-500" />
            Patrimônio — {MONTHS[month - 1]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalhamento</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-100">
            {investments.length === 0 && (
              <p className="text-sm text-zinc-400 py-6 text-center">Nenhum dado para este mês</p>
            )}
            {investments.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <p className="text-sm font-medium text-zinc-800">{inv.description}</p>
                <span className="text-sm font-semibold text-blue-600 tabular-nums">
                  {formatCurrency(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
