/**
 * Monthly SerpApi call counter — the quota guard (spec 7.7).
 *
 * Counters are kept in memory AND in the ApiUsage table when a database is
 * configured. The DB wins when it holds a larger value (e.g. after a
 * serverless cold start wipes memory).
 *
 * Only real SerpApi calls are counted. Mock-mode searches cost nothing and
 * must NOT increment.
 */

import { db } from "./db";

type MemCounter = { month: string; calls: number };
let mem: MemCounter = { month: "", calls: 0 };

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-10"
}

export function getMonthlyLimit(): number {
  const raw = Number(process.env.MONTHLY_CALL_LIMIT ?? 200);
  return Number.isFinite(raw) && raw > 0 ? raw : 200;
}

/** Total SerpApi calls made in the current month. */
export async function getCallsThisMonth(): Promise<number> {
  const month = currentMonth();
  let calls = mem.month === month ? mem.calls : 0;

  try {
    const prisma = await db();
    if (prisma) {
      const row = await prisma.apiUsage.findUnique({ where: { month } });
      if (row && typeof row.calls === "number") calls = Math.max(calls, row.calls);
    }
  } catch {
    // DB failure must never break quota reads
  }

  return calls;
}

/** Increment the monthly counter (call once per SerpApi request). */
export async function incrementCalls(n = 1): Promise<number> {
  const month = currentMonth();
  if (mem.month !== month) mem = { month, calls: 0 };
  mem.calls += n;

  try {
    const prisma = await db();
    if (prisma) {
      await prisma.apiUsage.upsert({
        where: { month },
        create: { month, calls: n },
        update: { calls: { increment: n } },
      });
    }
  } catch {
    // silent — memory counter still works
  }

  return mem.calls;
}

/** True when the next SerpApi call would exceed the monthly limit. */
export async function isQuotaExceeded(): Promise<boolean> {
  return (await getCallsThisMonth()) >= getMonthlyLimit();
}
