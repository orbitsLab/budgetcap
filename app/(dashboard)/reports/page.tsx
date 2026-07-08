import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccounts } from "@/app/actions/accounts";
import { ReportsClient } from "@/components/reports/reports-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
};

function ReportsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-40 bg-muted/60 rounded"></div>
          <div className="h-4 w-60 bg-muted/60 rounded mt-2"></div>
        </div>
        <div className="h-10 w-32 bg-muted/60 rounded"></div>
      </div>
      <div className="h-10 w-full bg-muted/60 rounded-md"></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-muted/40 rounded-xl border border-border/50"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 h-[340px] bg-muted/40 rounded-xl border border-border/50"></div>
        <div className="lg:col-span-7 h-[340px] bg-muted/40 rounded-xl border border-border/50"></div>
      </div>
    </div>
  );
}

async function ReportsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) redirect("/register");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Fetch all accounts, envelope sets with their envelopes, allocations and transactions
  const [accounts, envelopeSets, allocations, transactions] = await Promise.all([
    getAccounts(member.householdId),
    prisma.envelopeSet.findMany({
      where: { householdId: member.householdId },
      orderBy: { position: "asc" },
      include: {
        envelopes: {
          where: { isArchived: false },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.allocation.findMany({
      where: {
        envelope: {
          envelopeSet: {
            householdId: member.householdId,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: { householdId: member.householdId },
      orderBy: { date: "desc" },
    }),
  ]);

  // Clean serialization of dates/rich objects before passing across server-client boundary
  const serializedAccounts = accounts.map((acc: any) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    openingBalanceInPaise: acc.openingBalanceInPaise,
    balanceInPaise: acc.balanceInPaise,
  }));

  const serializedEnvelopeSets = envelopeSets.map((set: any) => ({
    id: set.id,
    name: set.name,
    accountId: set.accountId,
    startsOnDay: set.startsOnDay,
    envelopes: set.envelopes.map((env: any) => ({
      id: env.id,
      name: env.name,
      isGoal: env.isGoal,
      goalAmountInPaise: env.goalAmountInPaise,
      goalDeadline: env.goalDeadline ? env.goalDeadline.toISOString() : null,
      envelopeSetId: env.envelopeSetId,
    })),
  }));

  const serializedAllocations = allocations.map((alloc: any) => ({
    id: alloc.id,
    envelopeId: alloc.envelopeId,
    month: alloc.month,
    year: alloc.year,
    amountInPaise: alloc.amountInPaise,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializedTransactions = transactions.map((t: any) => ({
    id: t.id,
    type: t.type as "INCOME" | "EXPENSE" | "TRANSFER",
    amountInPaise: t.amountInPaise,
    date: t.date.toISOString(),
    envelopeId: t.envelopeId,
    toEnvelopeId: t.toEnvelopeId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    payee: t.payee,
    notes: t.notes,
  }));

  return (
    <ReportsClient
      accounts={serializedAccounts}
      envelopeSets={serializedEnvelopeSets}
      allocations={serializedAllocations}
      transactions={serializedTransactions}
      currentMonth={month}
      currentYear={year}
    />
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}
