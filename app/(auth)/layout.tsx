import type { ReactNode } from "react";
import { IndianRupee } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 p-4">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2 select-none">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
          <IndianRupee className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-foreground">
          GoodBudget
        </span>
      </div>
      {children}
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Zero-based envelope budgeting · Built for India
      </p>
    </div>
  );
}
