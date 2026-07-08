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
    const existingTx = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: existingTx.householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const data = await request.json();
    const {
      type,
      date,
      amountInPaise,
      payee,
      notes,
      envelopeId,
      toEnvelopeId,
      accountId,
      toAccountId,
      isRecurring,
      recurringDayOfMonth,
    } = data;

    if (!type || !date || !amountInPaise || amountInPaise <= 0) {
      return NextResponse.json({ error: "Invalid transaction data" }, { status: 400 });
    }

    if (type === "TRANSFER") {
      const hasEnvelopeTransfer = envelopeId && toEnvelopeId;
      const hasAccountTransfer = accountId && toAccountId;
      if (!hasEnvelopeTransfer && !hasAccountTransfer) {
        return NextResponse.json({ error: "Transfer requires either source & destination envelopes, or source & destination accounts." }, { status: 400 });
      }
      if (envelopeId && toEnvelopeId && envelopeId === toEnvelopeId) {
        return NextResponse.json({ error: "Source and destination envelopes must be different." }, { status: 400 });
      }
      if (accountId && toAccountId && accountId === toAccountId) {
        return NextResponse.json({ error: "Source and destination accounts must be different." }, { status: 400 });
      }
    }

    const tx = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        date: new Date(date),
        amountInPaise,
        payee: payee || null,
        notes: notes || null,
        envelopeId: envelopeId || null,
        toEnvelopeId: type === "TRANSFER" ? toEnvelopeId || null : null,
        accountId: accountId || null,
        toAccountId: type === "TRANSFER" ? toAccountId || null : null,
        isRecurring: isRecurring ?? false,
        recurringDayOfMonth: isRecurring ? recurringDayOfMonth ?? null : null,
      },
    });

    return NextResponse.json({ success: true, id: tx.id });
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
    const existingTx = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId: existingTx.householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
