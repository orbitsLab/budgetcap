import { NextResponse } from "next/server";
import { generateRecurringTransactions } from "@/app/actions/transactions";

/**
 * GET /api/cron/recurring
 *
 * Triggered by Vercel Cron (see vercel.json) or any HTTP client.
 * Generates recurring transactions that are due today.
 *
 * Security: Vercel automatically passes a CRON_SECRET header.
 * For manual invocation, pass: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Validate cron secret (skip in dev for convenience)
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await generateRecurringTransactions();

  return NextResponse.json({
    ok: true,
    generated: result.generated,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
