import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccounts, getAccountTotals } from "@/app/actions/accounts";
import { AccountsClient } from "@/components/accounts/accounts-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accounts",
};

async function AccountsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) redirect("/register");

  const [accounts, totals] = await Promise.all([
    getAccounts(member.householdId),
    getAccountTotals(member.householdId),
  ]);

  return (
    <AccountsClient
      householdId={member.householdId}
      accounts={accounts}
      totalBalance={totals.totalBalanceInPaise}
    />
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          Loading accounts...
        </div>
      }
    >
      <AccountsContent />
    </Suspense>
  );
}
