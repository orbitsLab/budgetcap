import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/app/actions/transactions";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionsSkeleton } from "@/components/transactions/transactions-skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transactions" };

async function TransactionsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) redirect("/register");

  const { transactions, total } = await getTransactions(member.householdId, {
    limit: 25,
  });

  // Fetch all envelopes for the add dialog + filter dropdown
  const envelopeSets = await prisma.envelopeSet.findMany({
    where: { householdId: member.householdId },
    orderBy: { position: "asc" },
    include: {
      envelopes: {
        where: { isArchived: false },
        orderBy: { position: "asc" },
      },
    },
  });

  const envelopes = envelopeSets.flatMap((set: any) =>
    set.envelopes.map((env: any) => ({
      id: env.id,
      name: env.name,
      setName: set.name,
    }))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {total} total · all time
        </p>
      </div>

      <TransactionsTable
        transactions={transactions}
        total={total}
        householdId={member.householdId}
        envelopes={envelopes}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsContent />
    </Suspense>
  );
}
