import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth-helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const envelope = await prisma.envelope.findUnique({
      where: { id },
      include: {
        envelopeSet: true,
      },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: envelope.envelopeSet.householdId },
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const data = await request.json();
    const { name, envelopeSetId, initialAmountInPaise, isArchived, isGoal, goalAmountInPaise, goalDeadline } = data;

    // If changing envelope set, verify the new set belongs to the same household
    if (envelopeSetId && envelopeSetId !== envelope.envelopeSetId) {
      const newSet = await prisma.envelopeSet.findUnique({
        where: { id: envelopeSetId },
      });
      if (!newSet || newSet.householdId !== envelope.envelopeSet.householdId) {
        return NextResponse.json({ error: "Invalid target envelope set" }, { status: 400 });
      }
    }

    const updated = await prisma.envelope.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(envelopeSetId !== undefined && { envelopeSetId }),
        ...(initialAmountInPaise !== undefined && { initialAmountInPaise }),
        ...(isArchived !== undefined && { isArchived }),
        ...(isGoal !== undefined && { isGoal }),
        ...(goalAmountInPaise !== undefined && { goalAmountInPaise }),
        ...(goalDeadline !== undefined && { goalDeadline: goalDeadline ? new Date(goalDeadline) : null }),
      },
    });

    return NextResponse.json({ success: true, envelope: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const envelope = await prisma.envelope.findUnique({
      where: { id },
      include: {
        envelopeSet: true,
      },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: envelope.envelopeSet.householdId },
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.envelope.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
