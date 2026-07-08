"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser, type RegisterState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const initialState: RegisterState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive mt-1">{messages[0]}</p>;
}

export default function RegisterPage() {
  const router = useRouter();
  const [state, action, isPending] = useActionState(registerUser, initialState);

  useEffect(() => {
    if (state?.success) {
      toast.success("Account created! Please sign in.");
      router.push("/login");
    }
  }, [state, router]);

  return (
    <Card className="w-full max-w-sm shadow-xl shadow-black/5 dark:shadow-black/30">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create account</CardTitle>
        <CardDescription>Start your zero-based budgeting journey</CardDescription>
      </CardHeader>

      <form action={action}>
        <CardContent className="space-y-4">
          {state?.errors?._form && (
            <div
              role="alert"
              className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {state.errors._form[0]}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reg-name">Full Name</Label>
            <Input
              id="reg-name"
              name="name"
              type="text"
              placeholder="Aarav Sharma"
              autoComplete="name"
              required
            />
            <FieldError messages={state?.errors?.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <FieldError messages={state?.errors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              required
              minLength={6}
            />
            <FieldError messages={state?.errors?.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-household">Household Name</Label>
            <Input
              id="reg-household"
              name="householdName"
              type="text"
              placeholder="e.g. Sharma Family Budget"
              required
            />
            <FieldError messages={state?.errors?.householdName} />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            id="register-submit-btn"
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
              id="go-to-login-link"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
