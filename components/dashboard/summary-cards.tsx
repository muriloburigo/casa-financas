"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, Gift } from "lucide-react";

interface SummaryCardsProps {
  totalIncome: number;
  totalBenefits: number;
  totalExpenses: number;
  totalInvestments: number;
  balance: number;
}

export function SummaryCards({ totalIncome, totalBenefits, totalExpenses, totalInvestments, balance }: SummaryCardsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs text-zinc-500">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs text-zinc-500">
              <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
              Investimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(totalInvestments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs text-zinc-500">
              <Wallet className="h-3.5 w-3.5 text-zinc-500" />
              Saldo livre
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className={`text-xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {totalBenefits > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <Gift className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{formatCurrency(totalBenefits)}</span>
            {" "}em benefícios (iFood / vale alimentação) — não incluídos no saldo livre
          </p>
        </div>
      )}
    </div>
  );
}
