import { NextResponse } from "next/server";
import { getAccounts } from "@/app/actions/accounts";
import { getUserIdFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const householdId = request.headers.get("x-household-id") || searchParams.get("householdId");

    if (!householdId) {
      return NextResponse.json({ error: "Household ID is required" }, { status: 400 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const accounts = await getAccounts(householdId);
    return NextResponse.json(accounts);
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

    const { householdId, name, type, openingBalanceInPaise } = await request.json();

    if (!householdId || !name || !type) {
      return NextResponse.json({ error: "Invalid account data" }, { status: 400 });
    }

    // Verify user belongs to household
    const member = await prisma.householdMember.findFirst({
      where: { userId, householdId }
    });
    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const count = await prisma.account.count({ where: { householdId } });
    const isDefault = count === 0;

    const account = await prisma.account.create({
      data: {
        householdId,
        name,
        type,
        openingBalanceInPaise: openingBalanceInPaise || 0,
        isDefault,
        position: count,
      },
    });

    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
