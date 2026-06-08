import { db } from "@/lib/db";
import { categoryRules, creditCardTransactions } from "@/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await db.select().from(categoryRules).orderBy(categoryRules.pattern);
  return Response.json({ rules });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { pattern, category } = await req.json();
  if (!pattern || !category) return Response.json({ error: "pattern e category obrigatórios" }, { status: 400 });

  // Salva a regra
  const [rule] = await db.insert(categoryRules).values({ pattern, category }).returning();

  // Corrige transações existentes que batem com o padrão
  const updated = await db
    .update(creditCardTransactions)
    .set({ aiCategory: category })
    .where(ilike(creditCardTransactions.description, `%${pattern}%`))
    .returning({ id: creditCardTransactions.id });

  return Response.json({ rule, updatedTransactions: updated.length });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await db.delete(categoryRules).where(eq(categoryRules.id, id));
  return Response.json({ success: true });
}
