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
    const envelopeSet = await prisma.envelopeSet.findUnique({
      where: { id },
    });

    if (!envelopeSet) {
      return NextResponse.json({ error: "Envelope set not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: envelopeSet.householdId },
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const data = await request.json();
    const { name, accountId, startsOnDay } = data;

    const updated = await prisma.envelopeSet.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(accountId !== undefined && { accountId }),
        ...(startsOnDay !== undefined && { startsOnDay }),
      },
    });

    return NextResponse.json({ success: true, envelopeSet: updated });
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
    const envelopeSet = await prisma.envelopeSet.findUnique({
      where: { id },
    });

    if (!envelopeSet) {
      return NextResponse.json({ error: "Envelope set not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: envelopeSet.householdId },
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.envelopeSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
