import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/jwt";

/**
 * Extracts and verifies the user ID from the request headers (Bearer token) or session.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded?.userId) {
      return decoded.userId;
    }
  }

  // Fallback to cookie-based session
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * Returns the current authenticated session or redirects to /login.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}


/**
 * Returns the current user's primary Household.
 * Redirects to /login if not authenticated.
 * Redirects to /setup if no household exists.
 */
export async function getCurrentHousehold() {
  const session = await requireAuth();

  const member = await prisma.householdMember.findFirst({
    where: { userId: session.user!.id },
    include: { household: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) redirect("/setup");

  return member.household;
}

/**
 * Get current month and year as numbers.
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}
