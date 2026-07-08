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
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: account.householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const data = await request.json();
    const { name, type, openingBalanceInPaise } = data;

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(openingBalanceInPaise !== undefined && { openingBalanceInPaise }),
      },
    });

    return NextResponse.json({ success: true, account: updatedAccount });
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
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: account.householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Guard: cannot delete if it has transactions
    const txCount = await prisma.transaction.count({
      where: { OR: [{ accountId: id }, { toAccountId: id }] },
    });

    if (txCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: this account has ${txCount} transaction(s). Remove them first.` },
        { status: 400 }
      );
    }

    await prisma.account.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
