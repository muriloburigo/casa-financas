import { db } from "@/lib/db";
import { expenseEntries, incomeEntries } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { description, amount, month, year, type, recurring } = await req.json();

  // months to insert: just this month, or from this month to December
  const months: number[] = recurring
    ? Array.from({ length: 12 - month + 1 }, (_, i) => month + i)
    : [month];

  const rows = months.map((m) => ({
    description,
    amount: String(amount),
    month: m,
    year,
    status: "estimated" as const,
  }));

  if (type === "income") {
    await db.insert(incomeEntries).values(rows);
  } else {
    await db.insert(expenseEntries).values(rows);
  }

  return Response.json({ success: true, count: rows.length });
}
