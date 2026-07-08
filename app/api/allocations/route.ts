import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { envelopeId, month, year, amountInPaise } = await request.json();

    if (!envelopeId || !month || !year || amountInPaise === undefined || amountInPaise < 0) {
      return NextResponse.json({ error: "Invalid allocation data" }, { status: 400 });
    }

    // Guard: Verify envelope belongs to user's household
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        envelopeSet: {
          select: { householdId: true }
        }
      }
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: envelope.envelopeSet.householdId }
    });

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allocation = await prisma.allocation.upsert({
      where: {
        envelopeId_month_year: {
          envelopeId,
          month,
          year,
        },
      },
      update: { amountInPaise },
      create: {
        envelopeId,
        month,
        year,
        amountInPaise,
      },
    });

    return NextResponse.json({ success: true, allocation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
