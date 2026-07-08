import { NextResponse } from "next/server";
import { getTransactionsDb } from "@/lib/db-queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = request.headers.get("x-household-id") || searchParams.get("householdId");

    if (!householdId) {
      return NextResponse.json({ error: "Household ID is required" }, { status: 400 });
    }

    const envelopeId = searchParams.get("envelopeId") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const data = await getTransactionsDb(householdId, {
      envelopeId,
      accountId,
      from,
      to,
      limit,
      offset,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
