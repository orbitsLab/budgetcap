import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Get the user's primary household
  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    include: { household: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) {
    // No household — redirect to setup
    redirect("/register");
  }

  return (
    <DashboardShell
      householdName={member.household.name}
      userName={session.user.name ?? session.user.email ?? "User"}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
