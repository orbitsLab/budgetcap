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
});

export async function createEnvelope(envelopeSetId: string, name: string) {
  await requireAuth();
  const parsed = envelopeSchema.safeParse({ name, envelopeSetId });
  if (!parsed.success) return { error: "Invalid data." };

  const count = await prisma.envelope.count({ where: { envelopeSetId } });

  const envelope = await prisma.envelope.create({
    data: { name: parsed.data.name, envelopeSetId, position: count },
  });

  // Revalidate tags & paths
  revalidateTag("household_envelopes", "max");
  revalidateTag("household_dashboard_summary", "max");
  revalidatePath("/envelopes");
  revalidatePath("/budget");
  return { success: true, id: envelope.id };
}

export async function updateEnvelope(id: string, name: string) {
  await requireAuth();
  await prisma.envelope.update({ where: { id }, data: { name } });
  
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
