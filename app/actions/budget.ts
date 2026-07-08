"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath, revalidateTag } from "next/cache";
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
  isGoal: boolean;
  goalAmountInPaise: number | null;
  goalDeadline: Date | null;
  initialAmountInPaise: number; // default fill amount
}

export interface EnvelopeSetWithData {
  id: string;
  name: string;
  position: number;
  accountId: string | null;
  startsOnDay: number;
  envelopes: EnvelopeWithData[];
}

export interface DashboardSummary {
  toBudgetPaise: number;
  availablePaise: number;
  totalIncomePaise: number;
  totalAllocatedPaise: number;
}

// ─────────────────────────────────────────────────────────
// Fetch Utilities with Data Caching
// ─────────────────────────────────────────────────────────

/**
 * Returns basic list of EnvelopeSets + Envelopes for a household.
 */
export async function getEnvelopes(householdId: string): Promise<EnvelopeSetWithData[]> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/envelopes?householdId=${householdId}`,
    {
      headers: { "x-household-id": householdId },
      next: { tags: ["household_envelopes"] },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch envelopes");
  return res.json();
}

/**
 * Returns all EnvelopeSets + Envelopes with allocation and balance data
 * for a given household and month/year.
 */
export async function getEnvelopeSetsWithData(
  householdId: string,
  month: number,
  year: number
): Promise<EnvelopeSetWithData[]> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/envelopes?householdId=${householdId}&month=${month}&year=${year}`,
    {
      headers: { "x-household-id": householdId },
      next: { tags: ["household_envelopes"] },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch envelopes with data");
  return res.json();
}

/**
 * Returns full available balance including rollover for all envelopes.
 */
export async function getEnvelopeSetsWithRollover(
  householdId: string,
  month: number,
  year: number
): Promise<EnvelopeSetWithData[]> {
  // Our API endpoint already includes rollover when month/year are provided
  return getEnvelopeSetsWithData(householdId, month, year);
}

/**
 * Total income transactions for a household in a given month.
 */
export async function getTotalIncome(
  householdId: string,
  month: number,
  year: number
): Promise<number> {
  const summary = await getDashboardSummary(householdId, month, year);
  return summary.totalIncomePaise;
}

/**
 * Returns the calculated dashboard summary balances (To Budget, Available).
 */
export async function getDashboardSummary(
  householdId: string,
  month: number,
  year: number
): Promise<DashboardSummary> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/dashboard-summary?householdId=${householdId}&month=${month}&year=${year}`,
    {
      headers: { "x-household-id": householdId },
      next: { tags: ["household_dashboard_summary"] },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
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

  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/budget");
  return { success: true };
}

// ─────────────────────────────────────────────────────────
// Fill Envelopes — Add All / Set All
// ─────────────────────────────────────────────────────────

/**
 * Updates the default (initial) fill amount for an envelope.
 * This is the amount that will be pre-filled when the user clicks Add or Set.
 */
export async function updateEnvelopeInitialAmount(
  envelopeId: string,
  amountInPaise: number
): Promise<SaveAllocationResult> {
  await requireAuth();

  if (!envelopeId || amountInPaise < 0) return { error: "Invalid data." };

  await prisma.envelope.update({
    where: { id: envelopeId },
    data: { initialAmountInPaise: amountInPaise },
  });

  revalidateTag("household_envelopes", "max");
  revalidatePath("/budget");
  return { success: true };
}

export type FillMode = "add" | "set";

/**
 * Bulk fills all envelopes using their initialAmountInPaise.
 * - "add": adds the initial amount ON TOP of whatever is already allocated
 * - "set": sets the allocation to exactly the initial amount (replaces)
 */
export async function fillAllEnvelopes(
  envelopeIds: string[],
  month: number,
  year: number,
  mode: FillMode
): Promise<SaveAllocationResult> {
  await requireAuth();

  if (envelopeIds.length === 0) return { success: true };

  // Fetch current initial amounts and existing allocations in one go
  const envelopes = await prisma.envelope.findMany({
    where: { id: { in: envelopeIds } },
    include: {
      allocations: { where: { month, year } },
    },
  });

  await prisma.$transaction(
    envelopes.map((env: typeof envelopes[number]) => {
      const existing = env.allocations[0]?.amountInPaise ?? 0;
      const initial = env.initialAmountInPaise;
      const newAmount = mode === "add" ? existing + initial : initial;

      return prisma.allocation.upsert({
        where: { envelopeId_month_year: { envelopeId: env.id, month, year } },
        update: { amountInPaise: newAmount },
        create: { envelopeId: env.id, month, year, amountInPaise: newAmount },
      });
    })
  );

  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
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

  const set = await prisma.envelopeSet.create({
    data: { name: parsed.data.name, householdId, position: count },
  });

  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true, id: set.id };
}

export async function updateEnvelopeSet(id: string, name: string) {
  await requireAuth();
  await prisma.envelopeSet.update({ where: { id }, data: { name } });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function deleteEnvelopeSet(id: string) {
  await requireAuth();
  await prisma.envelopeSet.delete({ where: { id } });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function updateEnvelopeSetSettings(
  id: string,
  settings: { accountId?: string | null; startsOnDay?: number }
) {
  await requireAuth();
  await prisma.envelopeSet.update({
    where: { id },
    data: {
      accountId: settings.accountId,
      startsOnDay: settings.startsOnDay,
    },
  });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

const envelopeSchema = z.object({
  name: z.string().min(1).max(100),
  envelopeSetId: z.string().cuid(),
  initialAmountInPaise: z.number().int().min(0).default(0),
});

export async function createEnvelope(
  envelopeSetId: string,
  name: string,
  initialAmountInPaise: number = 0
) {
  await requireAuth();
  const parsed = envelopeSchema.safeParse({ name, envelopeSetId, initialAmountInPaise });
  if (!parsed.success) return { error: "Invalid data." };

  const count = await prisma.envelope.count({ where: { envelopeSetId } });

  const envelope = await prisma.envelope.create({
    data: {
      name: parsed.data.name,
      envelopeSetId,
      position: count,
      initialAmountInPaise: parsed.data.initialAmountInPaise,
    },
  });

  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true, id: envelope.id };
}

export async function updateEnvelope(
  id: string,
  name: string,
  initialAmountInPaise?: number
) {
  await requireAuth();
  await prisma.envelope.update({
    where: { id },
    data: {
      name,
      ...(initialAmountInPaise !== undefined ? { initialAmountInPaise } : {}),
    },
  });

  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function archiveEnvelope(id: string, isArchived: boolean) {
  await requireAuth();
  await prisma.envelope.update({ where: { id }, data: { isArchived } });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function toggleGoal(
  id: string,
  isGoal: boolean,
  goalAmountInPaise: number | null = null,
  goalDeadline: Date | null = null
) {
  await requireAuth();
  await prisma.envelope.update({
    where: { id },
    data: { isGoal, goalAmountInPaise, goalDeadline },
  });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}

export async function deleteEnvelope(id: string) {
  await requireAuth();
  await prisma.envelope.delete({ where: { id } });
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
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
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
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
  
  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true };
}
