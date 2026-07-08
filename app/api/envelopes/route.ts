import { NextResponse } from "next/server";
import { getEnvelopesDb, getEnvelopeSetsWithRolloverDb } from "@/lib/db-queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = request.headers.get("x-household-id") || searchParams.get("householdId");
    
    if (!householdId) {
      return NextResponse.json({ error: "Household ID is required" }, { status: 400 });
    }

    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (monthStr && yearStr) {
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      const data = await getEnvelopeSetsWithRolloverDb(householdId, month, year);
      return NextResponse.json(data);
    }

    const data = await getEnvelopesDb(householdId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
