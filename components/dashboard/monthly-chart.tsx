"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { MONTHS } from "@/lib/utils";

interface MonthlyData {
  month: number;
  income: number;
  expenses: number;
}

interface MonthlyChartProps {
  data: MonthlyData[];
}

const formatK = (value: number) =>
  value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`;

export function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map((d) => ({
    name: MONTHS[d.month - 1].slice(0, 3),
    Receitas: d.income,
    Despesas: d.expenses,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
          }
        />
        <Legend />
        <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
