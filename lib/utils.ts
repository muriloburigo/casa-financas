import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Assinaturas",
  "Educação",
  "Esportes",
  "Habitação",
  "Impostos",
  "Lazer",
  "Mobilidade",
  "Saúde",
  "Serviços",
  "Vestuário",
  "Outros",
];

// Classificação de cada categoria em custo fixo/essencial vs. variável/estilo de vida,
// usada pelo módulo de Orçamento para aplicar a divisão 50% fixo / 30% variável / 20%+ investimento.
export const CATEGORY_BUCKET: Record<string, "fixed" | "variable"> = {
  "Habitação": "fixed",
  "Mobilidade": "fixed",
  "Educação": "fixed",
  "Saúde": "fixed",
  "Serviços": "fixed",
  "Impostos": "fixed",
  "Alimentação": "variable",
  "Lazer": "variable",
  "Esportes": "variable",
  "Assinaturas": "variable",
  "Vestuário": "variable",
  "Outros": "variable",
};

// Meta de investimento tratada como uma 12ª "categoria" no módulo de Orçamento —
// mesma tabela/fluxo dos tetos de despesa, mas com semântica invertida (ficar abaixo é o estado ruim).
export const INVESTMENT_CATEGORY = "Investimentos";
