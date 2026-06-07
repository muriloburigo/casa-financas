import { db } from "@/lib/db";
import { creditCardTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transactions = await db
    .select()
    .from(creditCardTransactions)
    .where(eq(creditCardTransactions.expenseEntryId, id))
    .orderBy(creditCardTransactions.transactionDate);

  return Response.json({ transactions });
}
