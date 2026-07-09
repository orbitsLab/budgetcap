import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { householdId, name } = await request.json();

    if (!householdId || !name) {
      return NextResponse.json({ error: "Household ID and name are required" }, { status: 400 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId },
    });

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const count = await prisma.envelopeSet.count({
      where: { householdId },
    });

    const envelopeSet = await prisma.envelopeSet.create({
      data: {
        householdId,
        name,
        position: count,
      },
    });

    return NextResponse.json({ success: true, envelopeSet });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
