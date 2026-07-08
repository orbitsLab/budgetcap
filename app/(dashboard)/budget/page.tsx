import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getEnvelopeSetsWithRollover,
  getTotalIncome,
} from "@/app/actions/budget";
import { BudgetClient } from "@/components/budget/budget-client";
import { BudgetSkeleton } from "@/components/budget/budget-skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Budget",
};

async function BudgetContent() {
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

  const [envelopeSets, totalIncome] = await Promise.all([
    getEnvelopeSetsWithRollover(member.householdId, month, year),
    getTotalIncome(member.householdId, month, year),
  ]);

  return (
    <BudgetClient
      envelopeSets={envelopeSets}
      totalIncomePaise={totalIncome}
      month={month}
      year={year}
    />
  );
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <BudgetContent />
    </Suspense>
  );
}
