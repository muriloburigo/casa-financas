import {
  pgTable,
  uuid,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  date,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense' | 'investment'
  color: text("color"),
  icon: text("icon"),
});

// 'paid' = pago (verde) | 'estimated' = estimado (futuro)
export const incomeEntries = pgTable("income_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("estimated"), // 'paid' | 'estimated'
  isBenefit: boolean("is_benefit").default(false), // benefício (vale alimentação, iFood) — não entra no saldo livre
  categoryId: uuid("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseEntries = pgTable("expense_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("estimated"), // 'paid' | 'estimated'
  categoryId: uuid("category_id").references(() => categories.id),
  isCreditCard: boolean("is_credit_card").default(false),
  creditCardName: text("credit_card_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditCardTransactions = pgTable("credit_card_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseEntryId: uuid("expense_entry_id").references(() => expenseEntries.id),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  transactionDate: date("transaction_date"),
  merchant: text("merchant"),
  aiCategory: text("ai_category"),
  aiSubcategory: text("ai_subcategory"),
  aiNotes: text("ai_notes"),
  isOptimizable: boolean("is_optimizable").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investmentEntries = pgTable("investment_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("estimated"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: varchar("role", { length: 10 }).notNull(),
  content: text("content").notNull(),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Regras de categoria para análise de faturas
export const categoryRules = pgTable("category_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  pattern: text("pattern").notNull(), // trecho do nome (case-insensitive)
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insights gerados pela IA — um por ano, atualizado manualmente
export const insightsCache = pgTable("insights_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  year: integer("year").notNull().unique(),
  payload: text("payload").notNull(), // JSON stringificado
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: text("generated_by"), // nome de quem gerou
});
