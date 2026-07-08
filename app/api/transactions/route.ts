import { NextResponse } from "next/server";
import { getTransactionsDb } from "@/lib/db-queries";
import { getUserIdFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const {
      householdId,
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

    if (!householdId || !type || !date || !amountInPaise || amountInPaise <= 0) {
      return NextResponse.json({ error: "Invalid transaction data" }, { status: 400 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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

    const tx = await prisma.transaction.create({
      data: {
        householdId,
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

