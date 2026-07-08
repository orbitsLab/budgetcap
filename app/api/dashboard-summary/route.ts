import { NextResponse } from "next/server";
import { getEnvelopeSetsWithRolloverDb, getTotalIncomeDb } from "@/lib/db-queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = request.headers.get("x-household-id") || searchParams.get("householdId");
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (!householdId) {
      return NextResponse.json({ error: "Household ID is required" }, { status: 400 });
    }

    const now = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    const [envelopeSets, totalIncomePaise] = await Promise.all([
      getEnvelopeSetsWithRolloverDb(householdId, month, year),
      getTotalIncomeDb(householdId, month, year),
    ]);

    const totalAllocatedPaise = envelopeSets
      .flatMap((s) => s.envelopes)
      .reduce((sum, e) => sum + e.allocatedPaise, 0);

    const toBudgetPaise = totalIncomePaise - totalAllocatedPaise;

    const availablePaise = envelopeSets
      .flatMap((s) => s.envelopes)
      .reduce((sum, e) => sum + e.availablePaise, 0);

    return NextResponse.json({
      toBudgetPaise,
      availablePaise,
      totalIncomePaise,
      totalAllocatedPaise,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
