"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ className, size = 32, showText = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="relative flex shrink-0 items-center justify-center">
        {/* Light mode logo */}
        <img
          src="/bugetcap-logo-light.png"
          alt="Budgetcap"
          style={{ width: size, height: size }}
          className="dark:hidden object-contain"
        />
        {/* Dark mode logo */}
        <img
          src="/bugetcap-logo-dark.png"
          alt="Budgetcap"
          style={{ width: size, height: size }}
          className="hidden dark:block object-contain"
        />
      </div>
      {showText && (
        <span className="font-bold tracking-tight text-foreground text-lg">
          Budgetcap
        </span>
      )}
    </div>
  );
}
