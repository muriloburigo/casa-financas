import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseEntries, incomeEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages } = await req.json();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [expenses, incomes] = await Promise.all([
    db.select().from(expenseEntries).where(eq(expenseEntries.year, currentYear)),
    db.select().from(incomeEntries).where(eq(incomeEntries.year, currentYear)),
  ]);

  const systemPrompt = `Você é um assistente financeiro pessoal da família Burigo. Você tem acesso aos dados financeiros da casa e pode ajudar a analisar gastos, registrar novos lançamentos e identificar oportunidades de otimização.

CONTEXTO ATUAL (${currentYear}):
- Mês atual: ${currentMonth}
- Total de receitas no ano: R$ ${incomes.reduce((s, i) => s + parseFloat(i.amount), 0).toFixed(2)}
- Total de despesas no ano: R$ ${expenses.reduce((s, e) => s + parseFloat(e.amount), 0).toFixed(2)}

DESPESAS DO MÊS ATUAL (mês ${currentMonth}):
${expenses
  .filter((e) => e.month === currentMonth)
  .map((e) => `- ${e.description}: R$ ${parseFloat(e.amount).toFixed(2)} [${e.status === "paid" ? "pago" : "estimado"}]`)
  .join("\n") || "Nenhuma despesa registrada"}

RECEITAS DO MÊS ATUAL (mês ${currentMonth}):
${incomes
  .filter((i) => i.month === currentMonth)
  .map((i) => `- ${i.description}: R$ ${parseFloat(i.amount).toFixed(2)} [${i.status === "paid" ? "pago" : "estimado"}]`)
  .join("\n") || "Nenhuma receita registrada"}

REGRAS:
- Status "pago" = já realizado (verde), "estimado" = previsão futura
- Cartões principais: Nubank Mu, Nubank Ma, Cartão Caixa
- Família: Murilo (Mú) e Marina (Má), filhos Mateus e Davi
- Sempre responda em português brasileiro
- Quando registrar um lançamento, confirme o que foi salvo`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: systemPrompt,
    messages,
    tools: {
      addExpense: tool({
        description: "Registra uma nova despesa no sistema",
        parameters: z.object({
          description: z.string().describe("Nome da despesa"),
          amount: z.number().describe("Valor em reais"),
          month: z.number().min(1).max(12).describe("Mês (1-12)"),
          year: z.number().describe("Ano"),
          status: z.enum(["paid", "estimated"]).describe("pago ou estimado"),
          isCreditCard: z.boolean().optional(),
          creditCardName: z.string().optional(),
        }),
        execute: async (params) => {
          await db.insert(expenseEntries).values({
            description: params.description,
            amount: params.amount.toString(),
            month: params.month,
            year: params.year,
            status: params.status,
            isCreditCard: params.isCreditCard ?? false,
            creditCardName: params.creditCardName ?? null,
          });
          return { success: true, message: `Despesa "${params.description}" de R$ ${params.amount.toFixed(2)} registrada.` };
        },
      }),
      addIncome: tool({
        description: "Registra uma nova receita no sistema",
        parameters: z.object({
          description: z.string().describe("Nome da receita"),
          amount: z.number().describe("Valor em reais"),
          month: z.number().min(1).max(12).describe("Mês (1-12)"),
          year: z.number().describe("Ano"),
          status: z.enum(["paid", "estimated"]).describe("pago ou estimado"),
        }),
        execute: async (params) => {
          await db.insert(incomeEntries).values({
            description: params.description,
            amount: params.amount.toString(),
            month: params.month,
            year: params.year,
            status: params.status,
          });
          return { success: true, message: `Receita "${params.description}" de R$ ${params.amount.toFixed(2)} registrada.` };
        },
      }),
      getMonthSummary: tool({
        description: "Retorna o resumo financeiro de um mês específico",
        parameters: z.object({
          month: z.number().min(1).max(12),
          year: z.number(),
        }),
        execute: async (params) => {
          const [exp, inc] = await Promise.all([
            db.select().from(expenseEntries).where(
              and(eq(expenseEntries.month, params.month), eq(expenseEntries.year, params.year))
            ),
            db.select().from(incomeEntries).where(
              and(eq(incomeEntries.month, params.month), eq(incomeEntries.year, params.year))
            ),
          ]);
          const totalExp = exp.reduce((s, e) => s + parseFloat(e.amount), 0);
          const totalInc = inc.reduce((s, i) => s + parseFloat(i.amount), 0);
          return {
            month: params.month,
            year: params.year,
            totalIncome: totalInc,
            totalExpenses: totalExp,
            balance: totalInc - totalExp,
            expenses: exp.map((e) => ({ desc: e.description, amount: parseFloat(e.amount), status: e.status })),
            incomes: inc.map((i) => ({ desc: i.description, amount: parseFloat(i.amount), status: i.status })),
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
