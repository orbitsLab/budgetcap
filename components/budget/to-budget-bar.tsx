"use client";

import { formatINR } from "@/lib/utils";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToBudgetBarProps {
  totalIncomePaise: number;
  totalAllocatedPaise: number;
}

export function ToBudgetBar({ totalIncomePaise, totalAllocatedPaise }: ToBudgetBarProps) {
  const toBudgetPaise = totalIncomePaise - totalAllocatedPaise;
  const isPositive = toBudgetPaise >= 0;
  const isZero = toBudgetPaise === 0;
  const progressPercent =
    totalIncomePaise > 0
      ? Math.min((totalAllocatedPaise / totalIncomePaise) * 100, 100)
      : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Main metric */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              isZero
                ? "bg-positive/10"
                : isPositive
                ? "bg-primary/10"
                : "bg-negative/10"
            )}
          >
            <Wallet
              className={cn(
                "h-6 w-6",
                isZero
                  ? "text-positive"
                  : isPositive
                  ? "text-primary"
                  : "text-negative"
              )}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">To Budget</p>
            <p
              className={cn(
                "text-3xl font-bold tracking-tight",
                isZero
                  ? "text-positive"
                  : isPositive
                  ? "text-foreground"
                  : "text-negative"
              )}
            >
              {formatINR(Math.abs(toBudgetPaise))}
              {toBudgetPaise < 0 && " over"}
            </p>
          </div>
        </div>

        {/* Income / Allocated summary */}
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-center sm:items-end gap-0.5">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-positive" />
              Income
            </span>
            <span className="font-semibold text-foreground">
              {formatINR(totalIncomePaise)}
            </span>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-0.5">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-primary" />
              Allocated
            </span>
            <span className="font-semibold text-foreground">
              {formatINR(totalAllocatedPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progressPercent.toFixed(0)}% allocated</span>
          {!isPositive && (
            <span className="text-negative font-medium">Over budget</span>
          )}
          {isZero && (
            <span className="text-positive font-medium">
              ✓ Fully allocated
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              !isPositive ? "bg-negative" : isZero ? "bg-positive" : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
