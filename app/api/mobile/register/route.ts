import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { name, email, password, householdName } = await request.json();

    if (!name || !email || !password || !householdName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "This email is already registered." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });

      const household = await tx.household.create({
        data: { name: householdName, ownerId: user.id },
      });

      const member = await tx.householdMember.create({
        data: { householdId: household.id, userId: user.id, role: "OWNER" },
      });

      return { user, household };
    });

    const token = signToken({ userId: result.user.id, email: result.user.email });

    return NextResponse.json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      householdId: result.household.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
