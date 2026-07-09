import { NextResponse } from "next/server";
import { getEnvelopesDb, getEnvelopeSetsWithRolloverDb } from "@/lib/db-queries";
import { getUserIdFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { envelopeSetId, name, initialAmountInPaise, isGoal, goalAmountInPaise } = await request.json();

    if (!envelopeSetId || !name) {
      return NextResponse.json({ error: "Envelope set ID and name are required" }, { status: 400 });
    }

    // Verify envelopeSet belongs to user's household
    const set = await prisma.envelopeSet.findUnique({
      where: { id: envelopeSetId },
    });

    if (!set) {
      return NextResponse.json({ error: "Envelope set not found" }, { status: 404 });
    }

    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: set.householdId },
    });

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const count = await prisma.envelope.count({
      where: { envelopeSetId },
    });

    const envelope = await prisma.envelope.create({
      data: {
        envelopeSetId,
        name,
        initialAmountInPaise: initialAmountInPaise || 0,
        position: count,
        isGoal: isGoal || false,
        goalAmountInPaise: goalAmountInPaise || null,
      },
    });

    return NextResponse.json({ success: true, envelope });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
