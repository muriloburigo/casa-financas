import { db } from "@/lib/db";
import { users, incomeEntries, expenseEntries, investmentEntries } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

// POST /api/seed — only runs if no users exist
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.select().from(users);
  if (existing.length > 0) {
    return Response.json({ message: "Already seeded" });
  }

  const passwordHash = await bcrypt.hash(process.env.INITIAL_PASSWORD!, 12);

  await db.insert(users).values([
    { name: "Murilo", email: "muriloburigo@gmail.com", passwordHash },
    { name: "Marina", email: process.env.MARINA_EMAIL!, passwordHash },
  ]);

  // Seed 2026 data from spreadsheet
  const year = 2026;

  // Income data
  const incomeData = [
    { description: "Salário Mú", amounts: [20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000] },
    { description: "iFood Mu", amounts: [1300, 1300, 1300, 1300, 1300, 1300, 1300, 1300, 1300, 1300, 1300, 1300] },
    { description: "Aluguel", amounts: [4000, 4000, 4000, 3800, 0, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Salário Má", amounts: [11760, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000] },
    { description: "iFood Má", amounts: [1200, 1100, 1210, 1210, 1155, 1210, 1265, 1155, 1210, 1210, 1155, 1265] },
  ];

  const expenseData = [
    { description: "Nubank Ma", amounts: [606.56, 1957.25, 1330.58, 487.33, 248.49, 0, 0, 0, 0, 0, 0, 0], isCreditCard: true, creditCardName: "Nubank Ma" },
    { description: "Nubank Mu", amounts: [6963.51, 7768.95, 5159.85, 5944.35, 7409.68, 8659.64, 5000, 5000, 5000, 5000, 5000, 5000], isCreditCard: true, creditCardName: "Nubank Mu" },
    { description: "Cartão Caixa", amounts: [7700.73, 11005.33, 10597.71, 8597.20, 8077.61, 5000, 5000, 5000, 5000, 5000, 5000, 5000], isCreditCard: true, creditCardName: "Cartão Caixa" },
    { description: "Escola", amounts: [2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96, 2903.96] },
    { description: "Financiamento", amounts: [7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39, 7670.39] },
    { description: "Condomínio", amounts: [1441.94, 1443.15, 1392.82, 2139.27, 2208.03, 2143.94, 2100, 2100, 2100, 2100, 2100, 2100] },
    { description: "Celesc", amounts: [494.73, 710.21, 765.54, 618.96, 446.53, 458.67, 494.73, 494.73, 494.73, 494.73, 494.73, 494.73] },
    { description: "Carro", amounts: [3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 3033.83, 0, 0] },
    { description: "Faxina", amounts: [1000, 1050, 1250, 1000, 1000, 1250, 1000, 1000, 1250, 1000, 1000, 1250] },
    { description: "Seguro de vida", amounts: [234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93, 234.93] },
    { description: "Internet + Celular Mu", amounts: [155, 155, 155, 155, 164.97, 165, 155, 155, 155, 155, 155, 155] },
    { description: "Celular Má / Mateus", amounts: [110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110] },
    { description: "Psicóloga Mateus", amounts: [0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000] },
    { description: "Vôlei Mateus", amounts: [0, 0, 255.90, 265.90, 265.90, 265.90, 265.90, 265.90, 265.90, 265.90, 265.90, 265.90] },
    { description: "Futebol Davi", amounts: [0, 0, 390, 190, 190, 0, 200, 200, 200, 200, 200, 200] },
    { description: "GPS Ma", amounts: [166.98, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31, 178.31] },
    { description: "DAS Ma", amounts: [705.61, 705.61, 720, 720, 720, 720, 720, 720, 720, 720, 720, 720] },
    { description: "Conect Car", amounts: [167.36, 0, 100, 50, 50, 100, 100, 100, 100, 100, 100, 100] },
    { description: "IPTU/IPVA/LICENCIAMENTO", amounts: [915.67, 0, 377.97, 0, 0, 149.37, 0, 150, 3200, 0, 0, 0] },
    { description: "Natação Mateus", amounts: [280, 280, 380, 380, 0, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Massagem Marina", amounts: [150, 0, 0, 0, 150, 150, 150, 150, 150, 150, 150, 150] },
    { description: "Manicure Marina", amounts: [0, 0, 0, 0, 0, 200, 200, 200, 200, 200, 200, 200] },
    { description: "Violão Mateus", amounts: [0, 0, 0, 0, 0, 0, 300, 300, 300, 300, 300, 300] },
    { description: "Psicóloga Davi", amounts: [0, 0, 0, 1500, 0, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Triathlon Davi", amounts: [0, 0, 95.50, 573, 0, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Endurance On", amounts: [0, 1202.67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { description: "CRP", amounts: [521.17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];

  const investmentData = [
    { description: "Guardado Mú", amounts: [99343.05, 97789.37, 95831.56, 92884.93, 83239.72, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Cashback Mú", amounts: [4408.91, 4592.41, 4643.14, 4729.63, 4799.66, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Fundo Caixa", amounts: [63389.07, 64184.69, 64743.14, 65626.92, 66182.84, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Wise Mu", amounts: [1665.02, 6118.04, 5797.27, 37.94, 5263.21, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Wise Má", amounts: [0, 0, 0, 0, 13487.23, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Guardado Má", amounts: [5536.34, 5536.34, 5541.71, 5541.71, 6541.71, 0, 0, 0, 0, 0, 0, 0] },
    { description: "MB", amounts: [24172.25, 16251.20, 17102.15, 16633.91, 18423.63, 0, 0, 0, 0, 0, 0, 0] },
    { description: "Clear", amounts: [343761.47, 357222.29, 364581.18, 361025.90, 359803.97, 0, 0, 0, 0, 0, 0, 0] },
  ];

  // Determine status: months 1-5 = paid (Jan-May 2026), rest = estimated
  const paidMonths = 5;

  for (const item of incomeData) {
    for (let m = 1; m <= 12; m++) {
      const amount = item.amounts[m - 1];
      if (amount === 0) continue;
      await db.insert(incomeEntries).values({
        description: item.description,
        amount: amount.toString(),
        month: m,
        year,
        status: m <= paidMonths ? "paid" : "estimated",
      });
    }
  }

  for (const item of expenseData) {
    for (let m = 1; m <= 12; m++) {
      const amount = item.amounts[m - 1];
      if (amount === 0) continue;
      await db.insert(expenseEntries).values({
        description: item.description,
        amount: amount.toString(),
        month: m,
        year,
        status: m <= paidMonths ? "paid" : "estimated",
        isCreditCard: item.isCreditCard ?? false,
        creditCardName: item.creditCardName ?? null,
      });
    }
  }

  for (const item of investmentData) {
    for (let m = 1; m <= 12; m++) {
      const amount = item.amounts[m - 1];
      if (amount === 0) continue;
      await db.insert(investmentEntries).values({
        description: item.description,
        amount: amount.toString(),
        month: m,
        year,
        status: "paid",
      });
    }
  }

  return Response.json({ success: true, message: "Dados de 2026 importados com sucesso!" });
}
