import { auth } from "@/lib/auth";
import { getCategoryBreakdown } from "@/lib/categories";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "2026");

  const breakdown = await getCategoryBreakdown(month, year);

  const total = breakdown.reduce((s, v) => s + v.amount, 0);
  const categories = breakdown
    .map(({ category, amount, items }) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      items,
    }))
    .sort((a, b) => b.amount - a.amount);

  return Response.json({ categories, total });
}
