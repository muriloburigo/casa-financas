import { db } from "@/lib/db";
import { categoryRules, creditCardTransactions, expenseEntries } from "@/lib/db/schema";
import { ilike, eq } from "drizzle-orm";

const SEED_SECRET = process.env.SEED_SECRET;

const PREDEFINED: { pattern: string; category: string }[] = [
  { pattern: "Sesc Cacupé", category: "Alimentação" },
  { pattern: "Sesc Cacupe", category: "Alimentação" },
  { pattern: "SESC", category: "Alimentação" },
  { pattern: "Woom", category: "Vestuário" },
  { pattern: "Galo", category: "Mobilidade" },
];

export async function POST(req: Request) {
  const body = await req.json();
  const { secret, add, deleteEntries } = body as {
    secret: string;
    add?: { pattern: string; category: string }[];
    deleteEntries?: string[]; // descrições exatas de expenseEntries a remover de todos os meses
  };
  if (!SEED_SECRET || secret !== SEED_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const report: { pattern: string; category: string; inserted: boolean; txUpdated: number }[] = [];

  // 1. Insert predefined rules + any ad-hoc ones from the request body
  const toInsert = [...PREDEFINED, ...(add ?? [])];
  const existing = await db.select().from(categoryRules);
  const existingPatterns = new Set(existing.map((r) => r.pattern.toLowerCase()));

  for (const rule of toInsert) {
    if (!existingPatterns.has(rule.pattern.toLowerCase())) {
      await db.insert(categoryRules).values(rule);
    }
  }

  // 2. Load ALL rules (including newly inserted ones) and apply to existing transactions
  const allRules = await db.select().from(categoryRules);

  for (const rule of allRules) {
    const updated = await db
      .update(creditCardTransactions)
      .set({ aiCategory: rule.category })
      .where(ilike(creditCardTransactions.description, `%${rule.pattern}%`))
      .returning({ id: creditCardTransactions.id });

    report.push({
      pattern: rule.pattern,
      category: rule.category,
      inserted: !existingPatterns.has(rule.pattern.toLowerCase()),
      txUpdated: updated.length,
    });
  }

  // 3. Delete expense entries by description pattern
  const deletedEntries: { pattern: string; count: number }[] = [];
  for (const pattern of deleteEntries ?? []) {
    const deleted = await db
      .delete(expenseEntries)
      .where(ilike(expenseEntries.description, `%${pattern}%`))
      .returning({ id: expenseEntries.id });
    deletedEntries.push({ pattern, count: deleted.length });
  }

  return Response.json({ success: true, report, deletedEntries });
}
