import { db } from "@/lib/db";
import { expenseEntries, incomeEntries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { type, status, amount, isBenefit } = body;

  const patch: Record<string, unknown> = {};
  if (status !== undefined) patch.status = status;
  if (amount !== undefined) patch.amount = String(amount);
  if (isBenefit !== undefined) patch.isBenefit = isBenefit;

  if (type === "income") {
    await db.update(incomeEntries).set(patch).where(eq(incomeEntries.id, id));
  } else {
    await db.update(expenseEntries).set(patch).where(eq(expenseEntries.id, id));
  }

  return Response.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "income") {
    await db.delete(incomeEntries).where(eq(incomeEntries.id, id));
  } else {
    await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
  }

  return Response.json({ success: true });
}
