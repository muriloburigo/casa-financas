import { db } from "@/lib/db";
import { expenseEntries, incomeEntries } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { description, amount, month, year, type, recurring, isBenefit } = await req.json();

  const months: number[] = recurring
    ? Array.from({ length: 12 - month + 1 }, (_, i) => month + i)
    : [month];

  if (type === "income") {
    const rows = months.map((m) => ({
      description,
      amount: String(amount),
      month: m,
      year,
      status: "estimated" as const,
      isBenefit: isBenefit ?? false,
    }));
    await db.insert(incomeEntries).values(rows);
    return Response.json({ success: true, count: rows.length });
  } else {
    const rows = months.map((m) => ({
      description,
      amount: String(amount),
      month: m,
      year,
      status: "estimated" as const,
    }));
    await db.insert(expenseEntries).values(rows);
    return Response.json({ success: true, count: rows.length });
  }
}
