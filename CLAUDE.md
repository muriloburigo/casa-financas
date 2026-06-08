@AGENTS.md

# Casa Finanças

Aplicativo de gestão financeira familiar. Permite controle de transações, upload de faturas de cartão de crédito (extração via IA), insights financeiros gerados por Claude e chat sobre finanças.

## Stack

- **Framework**: Next.js 16 (App Router) — ver AGENTS.md antes de escrever código Next.js
- **Banco de dados**: Neon (PostgreSQL serverless) via `@neondatabase/serverless`
- **ORM**: Drizzle ORM — schema em `lib/db/schema.ts`, queries em `lib/db/index.ts`
- **Auth**: NextAuth v5 beta (`next-auth@5.0.0-beta`) com Drizzle adapter — config em `lib/auth.ts`
- **IA**: Anthropic Claude via `@ai-sdk/anthropic` (chat/streaming) + `@anthropic-ai/sdk` nativo (processamento de PDF com beta `pdfs-2024-09-25`)
- **UI**: Radix UI + Tailwind CSS v4 + componentes em `components/`
- **Formulários**: react-hook-form + zod

## Estrutura

```
app/
  (auth)/login/         — página de login
  (dashboard)/          — layout autenticado
    dashboard/          — visão geral financeira
    faturas/            — upload e gestão de faturas PDF
    transacoes/         — listagem e adição de transações
    insights/           — insights IA (geração manual, cache no banco)
    investimentos/       — carteira de investimentos
    chat/               — chat financeiro com Claude
  api/
    auth/               — NextAuth handler
    dashboard/          — dados do dashboard + categorias
    faturas/            — CRUD de faturas
    transacoes/         — CRUD de transações
    upload-fatura/      — upload PDF → extração texto → análise IA → salva transações
    insights/           — geração/leitura de insights
    category-rules/     — regras de categorização automática
    investimentos/      — CRUD de investimentos
    chat/               — streaming chat com Claude
lib/
  db/
    schema.ts           — schema Drizzle (tabelas: users, transactions, invoices, investments, insights, categoryRules)
    index.ts            — cliente Neon + funções de query
  auth.ts               — config NextAuth
  utils.ts              — utilitários (cn, formatação)
drizzle/                — migrations geradas pelo drizzle-kit
```

## Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run db:generate  # gera migration (após alterar schema)
npm run db:push      # aplica schema direto no banco (dev)
npm run db:studio    # abre Drizzle Studio
```

## Variáveis de ambiente necessárias

```
DATABASE_URL          # connection string Neon
ANTHROPIC_API_KEY     # chave da API Anthropic
AUTH_SECRET           # segredo NextAuth
AUTH_GOOGLE_ID        # OAuth Google (opcional)
AUTH_GOOGLE_SECRET    # OAuth Google (opcional)
```

## Padrões importantes

- **Upload de fatura**: fluxo em duas etapas — (1) extração de texto do PDF com `unpdf` no browser, (2) envio do texto para `POST /api/upload-fatura` que chama Claude com o texto extraído
- **Insights**: gerados sob demanda (botão manual), armazenados no banco com timestamp — não regeram automaticamente
- **Regras de categoria**: tabela `categoryRules` define palavras-chave → categoria; aplicadas na análise de faturas
- **Auth**: middleware em `middleware.ts` protege rotas do grupo `(dashboard)`
