import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 p-4">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2 select-none">
        <Logo size={44} showText />
      </div>
      {children}
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Zero-based envelope budgeting · Built for India
      </p>
    </div>
  );
}
