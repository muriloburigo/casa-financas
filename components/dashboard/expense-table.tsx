"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { CheckCircle2, Clock } from "lucide-react";

interface Entry {
  id: string;
  description: string;
  amount: string;
  month: number;
  year: number;
  status: string;
  isCreditCard?: boolean;
  creditCardName?: string | null;
}

interface ExpenseTableProps {
  entries: Entry[];
  title: string;
}

export function ExpenseTable({ entries, title }: ExpenseTableProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="divide-y divide-zinc-100">
        {entries.length === 0 && (
          <p className="text-sm text-zinc-400 py-4 text-center">Nenhum lançamento</p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {entry.status === "paid" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-zinc-300 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-zinc-800">{entry.description}</p>
                {entry.isCreditCard && entry.creditCardName && (
                  <p className="text-xs text-zinc-400">{entry.creditCardName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={entry.status === "paid" ? "paid" : "estimated"}>
                {entry.status === "paid" ? "Pago" : "Estimado"}
              </Badge>
              <span className="text-sm font-semibold text-zinc-800 tabular-nums">
                {formatCurrency(entry.amount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
