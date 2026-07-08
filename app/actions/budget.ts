"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface EnvelopeWithData {
  id: string;
  name: string;
  isArchived: boolean;
  position: number;
  allocatedPaise: number;   // from Allocation this month
  spentPaise: number;       // from Transactions this month
  availablePaise: number;   // rollover + allocated - spent
}

export interface EnvelopeSetWithData {
  id: string;
  name: string;
  position: number;
  envelopes: EnvelopeWithData[];
}

// ─────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────

/**
 * Returns all EnvelopeSets + Envelopes with allocation and balance data
 * for a given household and month/year.
 */
export async function getEnvelopeSetsWithData(
  householdId: string,
  month: number,
  year: number
): Promise<EnvelopeSetWithData[]> {
  const sets = await prisma.envelopeSet.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
    include: {
      envelopes: {
        where: { isArchived: false },
        orderBy: { position: "asc" },
        include: {
          allocations: {
            where: { month, year },
          },
          transactions: {
            where: {
              type: "EXPENSE",
              date: {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1),
              },
            },
          },
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sets.map((set: any) => ({
    id: set.id,
    name: set.name,
    position: set.position,
    envelopes: set.envelopes.map((env: any) => {
      const allocatedPaise = env.allocations[0]?.amountInPaise ?? 0;
      const spentPaise = env.transactions.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, t: any) => sum + t.amountInPaise,
        0
      );

      // ── Rollover calculation (Step 5) ──────────────────────────
      // Sum all allocations and expenses prior to this month to get
      // the running balance carried forward.
      // Note: this is computed lazily — the heavy version is done
      // in the dedicated getRollover() helper below and merged in.
      const availablePaise = allocatedPaise - spentPaise;

      return {
        id: env.id,
        name: env.name,
        isArchived: env.isArchived,
        position: env.position,
        allocatedPaise,
        spentPaise,
        availablePaise,
      };
    }),
  }));
}

/**
 * Calculates the rollover (previous ending balance) for one envelope.
 * Rollover = sum(allocated - spent) for all months before the given one.
 */
async function getEnvelopeRollover(
  envelopeId: string,
  month: number,
  year: number
): Promise<number> {
  // Build a date boundary: start of the current month
  const boundary = new Date(year, month - 1, 1);

  const [allocationAgg, expenseAgg, incomeAgg] = await Promise.all([
    // All allocations before this month
    prisma.allocation.aggregate({
      where: {
        envelopeId,
        OR: [
          { year: { lt: year } },
          { year, month: { lt: month } },
        ],
      },
      _sum: { amountInPaise: true },
    }),
    // All expenses before this month
    prisma.transaction.aggregate({
      where: {
        envelopeId,
        type: "EXPENSE",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
    // All income credited directly to this envelope before this month
    prisma.transaction.aggregate({
      where: {
        envelopeId,
        type: "INCOME",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
  ]);

  const totalAllocated = allocationAgg._sum.amountInPaise ?? 0;
  const totalSpent = expenseAgg._sum.amountInPaise ?? 0;
  const totalIncome = incomeAgg._sum.amountInPaise ?? 0;

  return totalAllocated + totalIncome - totalSpent;
}

/**
 * Returns full available balance including rollover for all envelopes.
 * This is a heavier query used on the Budget page.
 */
export async function getEnvelopeSetsWithRollover(
  householdId: string,
  month: number,
  year: number
): Promise<EnvelopeSetWithData[]> {
  const sets = await getEnvelopeSetsWithData(householdId, month, year);

  // Compute rollovers in parallel
  const setsWithRollover = await Promise.all(
    sets.map(async (set) => ({
      ...set,
      envelopes: await Promise.all(
        set.envelopes.map(async (env) => {
          const rollover = await getEnvelopeRollover(env.id, month, year);
          const availablePaise = rollover + env.allocatedPaise - env.spentPaise;
          return { ...env, availablePaise };
        })
      ),
    }))
  );

  return setsWithRollover;
}

/**
 * Total income transactions for a household in a given month.
 */
export async function getTotalIncome(
  householdId: string,
  month: number,
  year: number
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      householdId,
      type: "INCOME",
      date: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    _sum: { amountInPaise: true },
  });
  return result._sum.amountInPaise ?? 0;
}

// ─────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────

const allocationSchema = z.object({
  envelopeId: z.string().cuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  amountInPaise: z.number().int().min(0),
});

export type SaveAllocationResult = { success: true } | { error: string };

export async function saveAllocation(
  envelopeId: string,
  month: number,
  year: number,
  amountInPaise: number
): Promise<SaveAllocationResult> {
  await requireAuth();

  const parsed = allocationSchema.safeParse({ envelopeId, month, year, amountInPaise });
  if (!parsed.success) return { error: "Invalid allocation data." };

  await prisma.allocation.upsert({
    where: {
      envelopeId_month_year: {
        envelopeId: parsed.data.envelopeId,
        month: parsed.data.month,
        year: parsed.data.year,
      },
    },
    update: { amountInPaise: parsed.data.amountInPaise },
    create: {
      envelopeId: parsed.data.envelopeId,
      month: parsed.data.month,
      year: parsed.data.year,
      amountInPaise: parsed.data.amountInPaise,
    },
  });

  revalidatePath("/budget");
  return { success: true };
}

// ─────────────────────────────────────────────────────────
// Envelope Set / Envelope CRUD
// ─────────────────────────────────────────────────────────

const envelopeSetSchema = z.object({
  name: z.string().min(1).max(100),
  householdId: z.string().cuid(),
});

export async function createEnvelopeSet(householdId: string, name: string) {
  await requireAuth();
  const parsed = envelopeSetSchema.safeParse({ name, householdId });
  if (!parsed.success) return { error: "Invalid data." };

  const count = await prisma.envelopeSet.count({
    where: { householdId },
  });

  await prisma.envelopeSet.create({
    data: { name: parsed.data.name, householdId, position: count },
  });

  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function updateEnvelopeSet(id: string, name: string) {
  await requireAuth();
  await prisma.envelopeSet.update({ where: { id }, data: { name } });
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function deleteEnvelopeSet(id: string) {
  await requireAuth();
  await prisma.envelopeSet.delete({ where: { id } });
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

const envelopeSchema = z.object({
  name: z.string().min(1).max(100),
  envelopeSetId: z.string().cuid(),
});

export async function createEnvelope(envelopeSetId: string, name: string) {
  await requireAuth();
  const parsed = envelopeSchema.safeParse({ name, envelopeSetId });
  if (!parsed.success) return { error: "Invalid data." };

  const count = await prisma.envelope.count({ where: { envelopeSetId } });

  await prisma.envelope.create({
    data: { name: parsed.data.name, envelopeSetId, position: count },
  });

  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function updateEnvelope(id: string, name: string) {
  await requireAuth();
  await prisma.envelope.update({ where: { id }, data: { name } });
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function archiveEnvelope(id: string, isArchived: boolean) {
  await requireAuth();
  await prisma.envelope.update({ where: { id }, data: { isArchived } });
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function deleteEnvelope(id: string) {
  await requireAuth();
  await prisma.envelope.delete({ where: { id } });
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function reorderEnvelopeSets(
  items: { id: string; position: number }[]
) {
  await requireAuth();
  await prisma.$transaction(
    items.map((item) =>
      prisma.envelopeSet.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    )
  );
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function reorderEnvelopes(items: { id: string; position: number }[]) {
  await requireAuth();
  await prisma.$transaction(
    items.map((item) =>
      prisma.envelope.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    )
  );
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}
