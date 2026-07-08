import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      householdMembers: { include: { household: true } },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and household preferences</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <h2 className="font-semibold text-foreground">Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-x-2 gap-y-1 sm:gap-y-2 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{user.name}</span>
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium break-all sm:break-normal">{user.email}</span>
          <span className="text-muted-foreground">Member since</span>
          <span className="font-medium">
            {new Date(user.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <h2 className="font-semibold text-foreground">Households</h2>
        {user.householdMembers.map((m: any) => (
          <div key={m.householdId} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{m.household.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{m.role.toLowerCase()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <h2 className="font-semibold text-foreground">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Currency</p>
            <p className="text-xs text-muted-foreground">Indian Rupee (₹ INR)</p>
          </div>
          <span className="text-xl">🇮🇳</span>
        </div>
      </div>
    </div>
  );
}
