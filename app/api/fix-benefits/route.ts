import { db } from "@/lib/db";
import { incomeEntries } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

// POST /api/fix-benefits — marca entradas iFood como isBenefit=true
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db
    .update(incomeEntries)
    .set({ isBenefit: true })
    .where(
      or(
        like(incomeEntries.description, "%ifood%"),
        like(incomeEntries.description, "%iFood%"),
        like(incomeEntries.description, "%IFood%"),
        like(incomeEntries.description, "%IFOOD%"),
        like(incomeEntries.description, "%vale alimenta%"),
        like(incomeEntries.description, "%Vale Alimenta%"),
      )
    )
    .returning({ id: incomeEntries.id, description: incomeEntries.description });

  return Response.json({ success: true, updated: result.length, entries: result.map((r) => r.description) });
}
