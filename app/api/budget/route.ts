import { db } from "@/lib/db";
import { budgetCaps, investmentEntries } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCategoryBreakdown } from "@/lib/categories";
import { INVESTMENT_CATEGORY } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "2026");
  const month = parseInt(searchParams.get("month") ?? (new Date().getMonth() + 1).toString());

  const [capRows, breakdown, investmentRows] = await Promise.all([
    db.select().from(budgetCaps).where(eq(budgetCaps.year, year)),
    getCategoryBreakdown(month, year),
    db.select().from(investmentEntries).where(and(eq(investmentEntries.month, month), eq(investmentEntries.year, year))),
  ]);

  const caps = capRows.map((r) => ({ category: r.category, monthlyCap: parseFloat(r.monthlyCap) }));
  const actual = [
    ...breakdown,
    {
      category: INVESTMENT_CATEGORY,
      amount: investmentRows.reduce((s, r) => s + parseFloat(r.amount), 0),
      items: investmentRows.map((r) => ({ description: r.description, amount: parseFloat(r.amount) })),
    },
  ];

  return Response.json({ caps, actual });
}

// Upsert em lote: { year, caps: [{ category, monthlyCap }, ...] }
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { year, caps } = await req.json();
  if (!year || !Array.isArray(caps) || caps.length === 0) {
    return Response.json({ error: "year e caps são obrigatórios" }, { status: 400 });
  }

  await db
    .insert(budgetCaps)
    .values(caps.map((c: { category: string; monthlyCap: number }) => ({
      year,
      category: c.category,
      monthlyCap: c.monthlyCap.toString(),
    })))
    .onConflictDoUpdate({
      target: [budgetCaps.year, budgetCaps.category],
      set: { monthlyCap: sql`excluded.monthly_cap`, updatedAt: sql`now()` },
    });

  return Response.json({ success: true });
}
