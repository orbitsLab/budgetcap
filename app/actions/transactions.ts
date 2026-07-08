"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const transactionSchema = z.object({
  householdId: z.string().cuid(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  amountInPaise: z.number().int().positive("Amount must be positive"),
  payee: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  envelopeId: z.string().cuid().optional().nullable(),
  toEnvelopeId: z.string().cuid().optional().nullable(), // TRANSFER destination
  accountId: z.string().cuid().optional().nullable(),
  toAccountId: z.string().cuid().optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringDayOfMonth: z.number().int().min(1).max(28).optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof transactionSchema>;
export type CreateTransactionResult = { success: true; id: string } | { error: string };

// ─────────────────────────────────────────────────────────
// Create Transaction
// ─────────────────────────────────────────────────────────

export async function createTransaction(
  data: CreateTransactionInput
): Promise<CreateTransactionResult> {
  await requireAuth();

  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid transaction data";
    return { error: msg };
  }

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
  } = parsed.data;

  // Validate TRANSFER has both envelopes
  if (type === "TRANSFER") {
    if (!envelopeId || !toEnvelopeId) {
      return { error: "Transfer requires both source and destination envelopes." };
    }
    if (envelopeId === toEnvelopeId) {
      return { error: "Source and destination envelopes must be different." };
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

  revalidatePath("/transactions");
  revalidatePath("/budget");
  return { success: true, id: tx.id };
}

// ─────────────────────────────────────────────────────────
// Delete Transaction
// ─────────────────────────────────────────────────────────

export async function deleteTransaction(id: string): Promise<{ success: boolean }> {
  await requireAuth();
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/transactions");
  revalidatePath("/budget");
  return { success: true };
}

// ─────────────────────────────────────────────────────────
// Fetch Transactions
// ─────────────────────────────────────────────────────────

export interface TransactionWithRelations {
  id: string;
  date: Date;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountInPaise: number;
  payee: string | null;
  notes: string | null;
  isRecurring: boolean;
  envelope: { id: string; name: string } | null;
  toEnvelope: { id: string; name: string } | null;
}

export async function getTransactions(
  householdId: string,
  options?: {
    envelopeId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ transactions: TransactionWithRelations[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    householdId,
    ...(options?.envelopeId
      ? {
          OR: [
            { envelopeId: options.envelopeId },
            { toEnvelopeId: options.envelopeId },
          ],
        }
      : {}),
    ...(options?.from || options?.to
      ? {
          date: {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.to ? { lte: options.to } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        envelope: { select: { id: true, name: true } },
        toEnvelope: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((t: typeof transactions[number]) => ({
      ...t,
      type: t.type as "INCOME" | "EXPENSE" | "TRANSFER",
    })),
    total,
  };
}

// ─────────────────────────────────────────────────────────
// Step 5: Generate Recurring Transactions
// Called by the cron API route on the 1st of each month
// ─────────────────────────────────────────────────────────

export async function generateRecurringTransactions(): Promise<{
  generated: number;
  errors: string[];
}> {
  const today = new Date();
  const dayOfMonth = today.getDate();

  // Find all recurring transaction templates due today
  const templates = await prisma.transaction.findMany({
    where: {
      isRecurring: true,
      recurringDayOfMonth: dayOfMonth,
      recurringParentId: null, // only templates, not generated copies
    },
  });

  let generated = 0;
  const errors: string[] = [];

  for (const template of templates) {
    // Check if already generated this month
    const alreadyExists = await prisma.transaction.findFirst({
      where: {
        recurringParentId: template.id,
        date: {
          gte: new Date(today.getFullYear(), today.getMonth(), 1),
          lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        },
      },
    });

    if (alreadyExists) continue;

    try {
      await prisma.transaction.create({
        data: {
          householdId: template.householdId,
          envelopeId: template.envelopeId,
          toEnvelopeId: template.toEnvelopeId,
          accountId: template.accountId,
          toAccountId: template.toAccountId,
          type: template.type,
          date: today,
          amountInPaise: template.amountInPaise,
          payee: template.payee,
          notes: template.notes ? `[Recurring] ${template.notes}` : "[Recurring]",
          isRecurring: false,
          recurringParentId: template.id,
        },
      });
      generated++;
    } catch (err) {
      errors.push(`Failed to generate from template ${template.id}: ${String(err)}`);
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/budget");
  return { generated, errors };
}
