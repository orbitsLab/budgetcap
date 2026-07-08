"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  householdName: z.string().min(2, "Household name must be at least 2 characters"),
});

export type RegisterState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    householdName?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function registerUser(
  prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    householdName: formData.get("householdName"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password, householdName } = parsed.data;

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["This email is already registered."] } };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create User + Household + HouseholdMember in a transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const household = await tx.household.create({
      data: { name: householdName, ownerId: user.id },
    });

    await tx.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: "OWNER" },
    });
  });

  return { success: true };
}

export type LoginState = {
  errors?: { _form?: string[] };
};

export async function loginUser(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { errors: { _form: ["Invalid email or password."] } };
        default:
          return { errors: { _form: ["Something went wrong. Please try again."] } };
      }
    }
    throw error;
  }

  redirect("/budget");
}
