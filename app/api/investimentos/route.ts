import { db } from "@/lib/db";
import { investmentEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? (new Date().getMonth() + 1).toString());
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString());

  const investments = await db
    .select()
    .from(investmentEntries)
    .where(and(eq(investmentEntries.month, month), eq(investmentEntries.year, year)));

  return Response.json({ investments });
}
