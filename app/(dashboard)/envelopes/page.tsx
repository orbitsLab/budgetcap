import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEnvelopes } from "@/app/actions/budget";
import { EnvelopesClient } from "@/components/budget/envelopes-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Envelopes" };

export default async function EnvelopesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) redirect("/register");

  const sets = await getEnvelopes(member.householdId);

  return (
    <EnvelopesClient
      householdId={member.householdId}
      initialSets={sets}
    />
  );
}
