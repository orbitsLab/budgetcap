import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/app/actions/transactions";
import { getAccounts } from "@/app/actions/accounts";
import { getEnvelopes } from "@/app/actions/budget";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionsSkeleton } from "@/components/transactions/transactions-skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transactions" };

interface PageProps {
  searchParams: Promise<{
    envelopeId?: string;
    accountId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: { envelopeId?: string; accountId?: string; from?: string; to?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) redirect("/register");

  const fromDate = searchParams.from ? new Date(searchParams.from) : undefined;
  const toDate = searchParams.to ? new Date(searchParams.to) : undefined;
  const pageNum = searchParams.page ? parseInt(searchParams.page, 10) : 0;
  const offset = pageNum * 25;

  const [{ transactions, total }, accounts, envelopeSets] = await Promise.all([
    getTransactions(member.householdId, {
      limit: 25,
      offset,
      envelopeId: searchParams.envelopeId,
      accountId: searchParams.accountId,
      from: fromDate,
      to: toDate,
    }),
    getAccounts(member.householdId),
    getEnvelopes(member.householdId),
  ]);

  const envelopes = envelopeSets.flatMap((set: any) =>
    (set.envelopes || [])
      .filter((env: any) => !env.isArchived)
      .map((env: any) => ({
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
        accounts={accounts}
        initialFilters={searchParams}
      />
    </div>
  );
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <Suspense fallback={<TransactionsSkeleton />} key={JSON.stringify(params)}>
      <TransactionsContent searchParams={params} />
    </Suspense>
  );
}
