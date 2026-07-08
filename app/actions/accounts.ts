"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface AccountWithBalance {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH";
  openingBalanceInPaise: number;
  isDefault: boolean;
  position: number;
  /** Computed: openingBalance + income - expenses (all time) */
  balanceInPaise: number;
  createdAt: Date;
}

export interface AccountTotals {
  totalBalanceInPaise: number;
  byType: Record<"CHECKING" | "SAVINGS" | "CASH", number>;
}

// ─────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────

/** Returns all accounts for a household with computed running balance. */
export async function getAccounts(
  householdId: string
): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
    include: {
      transactions: {
        select: { type: true, amountInPaise: true },
      },
      toTransactions: {
        select: { type: true, amountInPaise: true },
      },
    },
  });

  return accounts.map((acc: any) => {
    // Income coming INTO this account
    const income = acc.transactions
      .filter((t: any) => t.type === "INCOME")
      .reduce((s: number, t: any) => s + t.amountInPaise, 0);

    // Expenses going OUT of this account
    const expenses = acc.transactions
      .filter((t: any) => t.type === "EXPENSE")
      .reduce((s: number, t: any) => s + t.amountInPaise, 0);

    // Transfers OUT of this account
    const transfersOut = acc.transactions
      .filter((t: any) => t.type === "TRANSFER")
      .reduce((s: number, t: any) => s + t.amountInPaise, 0);

    // Transfers IN to this account
    const transfersIn = acc.toTransactions
      .filter((t: any) => t.type === "TRANSFER")
      .reduce((s: number, t: any) => s + t.amountInPaise, 0);

    const balanceInPaise =
      acc.openingBalanceInPaise + income - expenses - transfersOut + transfersIn;

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type as "CHECKING" | "SAVINGS" | "CASH",
      openingBalanceInPaise: acc.openingBalanceInPaise,
      isDefault: acc.isDefault,
      position: acc.position,
      balanceInPaise,
      createdAt: acc.createdAt,
    };
  });
}

/** Returns total balance across all accounts. */
export async function getAccountTotals(
  householdId: string
): Promise<AccountTotals> {
  const accounts = await getAccounts(householdId);

  const byType = accounts.reduce(
    (acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + a.balanceInPaise;
      return acc;
    },
    {} as Record<"CHECKING" | "SAVINGS" | "CASH", number>
  );

  const totalBalanceInPaise = accounts.reduce(
    (s, a) => s + a.balanceInPaise,
    0
  );

  return { totalBalanceInPaise, byType };
}

// ─────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────

const accountSchema = z.object({
  householdId: z.string().cuid(),
  name: z.string().min(1).max(100),
  type: z.enum(["CHECKING", "SAVINGS", "CASH"]),
  openingBalanceInPaise: z.number().int().default(0),
  isDefault: z.boolean().optional().default(false),
});

export type AccountActionResult = { success: true; id?: string } | { error: string };

/** Create a new account for a household. */
export async function createAccount(
  householdId: string,
  name: string,
  type: "CHECKING" | "SAVINGS" | "CASH",
  openingBalanceInPaise = 0
): Promise<AccountActionResult> {
  await requireAuth();

  const parsed = accountSchema.safeParse({
    householdId,
    name,
    type,
    openingBalanceInPaise,
  });
  if (!parsed.success) return { error: "Invalid account data." };

  const count = await prisma.account.count({ where: { householdId } });

  // First account created is always the default
  const isDefault = count === 0;

  const account = await prisma.account.create({
    data: {
      householdId,
      name: parsed.data.name,
      type: parsed.data.type,
      openingBalanceInPaise: parsed.data.openingBalanceInPaise,
      isDefault,
      position: count,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: true, id: account.id };
}

/** Update account name and/or type. */
export async function updateAccount(
  id: string,
  data: { name?: string; type?: "CHECKING" | "SAVINGS" | "CASH"; openingBalanceInPaise?: number }
): Promise<AccountActionResult> {
  await requireAuth();

  if (!id) return { error: "Account ID is required." };

  await prisma.account.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.openingBalanceInPaise !== undefined && {
        openingBalanceInPaise: data.openingBalanceInPaise,
      }),
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: true };
}

/** Set a different account as the default. */
export async function setDefaultAccount(
  householdId: string,
  accountId: string
): Promise<AccountActionResult> {
  await requireAuth();

  await prisma.$transaction([
    prisma.account.updateMany({
      where: { householdId },
      data: { isDefault: false },
    }),
    prisma.account.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/accounts");
  return { success: true };
}

/** Delete an account. Guard: cannot delete if it has transactions. */
export async function deleteAccount(id: string): Promise<AccountActionResult> {
  await requireAuth();

  const txCount = await prisma.transaction.count({
    where: { OR: [{ accountId: id }, { toAccountId: id }] },
  });

  if (txCount > 0) {
    return {
      error: `Cannot delete: this account has ${txCount} transaction(s). Remove them first.`,
    };
  }

  await prisma.account.delete({ where: { id } });

  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: true };
}

/** Reorder accounts by position. */
export async function reorderAccounts(
  items: { id: string; position: number }[]
): Promise<AccountActionResult> {
  await requireAuth();

  await prisma.$transaction(
    items.map((item) =>
      prisma.account.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    )
  );

  revalidatePath("/accounts");
  return { success: true };
}
