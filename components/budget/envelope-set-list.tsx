"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { saveAllocation } from "@/app/actions/budget";
import { formatINR, paiseToRupeeString, rupeesToPaise } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnvelopeSetWithData } from "@/app/actions/budget";
import type { AccountWithBalance } from "@/app/actions/accounts";
import { EnvelopeSetSettings } from "@/components/budget/envelope-set-settings";
import { Button } from "@/components/ui/button";

interface EnvelopeSetListProps {
  envelopeSets: EnvelopeSetWithData[];
  month: number;
  year: number;
  accounts: AccountWithBalance[];
  onAllocatedChange: (delta: number) => void;
}

export function EnvelopeSetList({
  envelopeSets,
  month,
  year,
  accounts,
  onAllocatedChange,
}: EnvelopeSetListProps) {
  if (envelopeSets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground text-sm">
          No envelopes yet.{" "}
          <a href="/envelopes" className="text-primary font-medium hover:underline">
            Create envelope sets
          </a>{" "}
          to start budgeting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {envelopeSets.map((set) => (
        <EnvelopeSetCard
          key={set.id}
          set={set}
          month={month}
          year={year}
          accounts={accounts}
          onAllocatedChange={onAllocatedChange}
        />
      ))}
    </div>
  );
}

function EnvelopeSetCard({
  set,
  month,
  year,
  accounts,
  onAllocatedChange,
}: {
  set: EnvelopeSetWithData;
  month: number;
  year: number;
  accounts: AccountWithBalance[];
  onAllocatedChange: (delta: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const setAllocated = set.envelopes.reduce((s, e) => s + e.allocatedPaise, 0);
  const setSpent = set.envelopes.reduce((s, e) => s + e.spentPaise, 0);
  const setAvailable = set.envelopes.reduce((s, e) => s + e.availablePaise, 0);

  const isGoalSet = set.envelopes.some((e) => e.isGoal);
  const linkedAccount = accounts.find((a) => a.id === set.accountId);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Set header */}
      <div className="flex items-center w-full px-4 py-2 hover:bg-muted/40 transition-colors">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 flex items-center justify-between text-left py-2"
          aria-expanded={!collapsed}
          id={`envelope-set-${set.id}-toggle`}
        >
          <div className="flex items-center gap-2">
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-foreground">
                {set.name}
                {linkedAccount ? ` (${linkedAccount.name})` : ""}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground sm:hidden mt-0.5">
                <span>Avail: <strong className={setAvailable < 0 ? "text-negative" : "text-positive"}>{formatINR(setAvailable)}</strong></span>
                <span>•</span>
                <span>Spent: <strong className="text-foreground">{formatINR(setSpent)}</strong></span>
              </div>
              {set.accountId && set.startsOnDay > 1 && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Starts on the {set.startsOnDay}
                  {set.startsOnDay === 1 ? "st" : set.startsOnDay === 2 ? "nd" : set.startsOnDay === 3 ? "rd" : "th"}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-1">
              ({set.envelopes.length})
            </span>
          </div>
          {/* Set totals */}
          <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground pr-4">
            <span>Allocated: <strong className="text-foreground">{formatINR(setAllocated)}</strong></span>
            <span>Spent: <strong className="text-foreground">{formatINR(setSpent)}</strong></span>
            <span>
              Available:{" "}
              <strong className={setAvailable < 0 ? "text-negative" : "text-positive"}>
                {formatINR(setAvailable)}
              </strong>
            </span>
          </div>
        </button>
        <EnvelopeSetSettings set={set} accounts={accounts} />
      </div>

      {/* Envelope rows */}
      {!collapsed && (
        <div className="divide-y divide-border border-t border-border">
          {/* Column headers */}
          {!isGoalSet ? (
            <div className="hidden sm:grid grid-cols-[1fr_140px_120px_100px] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Envelope</span>
              <span className="text-right">Allocated (₹)</span>
              <span className="text-right">Spent</span>
              <span className="text-right">Available</span>
            </div>
          ) : (
            <div className="hidden sm:grid grid-cols-[1fr_140px_120px] gap-4 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Goal</span>
              <span className="text-right">Save This Month (₹)</span>
              <span className="text-right">Saved</span>
            </div>
          )}

          {set.envelopes.map((env) =>
            env.isGoal ? (
              <GoalEnvelopeRow
                key={env.id}
                env={env}
                month={month}
                year={year}
                onAllocatedChange={onAllocatedChange}
              />
            ) : (
              <EnvelopeRow
                key={env.id}
                env={env}
                month={month}
                year={year}
                onAllocatedChange={onAllocatedChange}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function EnvelopeRow({
  env,
  month,
  year,
  onAllocatedChange,
}: {
  env: EnvelopeSetWithData["envelopes"][0];
  month: number;
  year: number;
  onAllocatedChange: (delta: number) => void;
}) {
  const [fillValue, setFillValue] = useState(
    paiseToRupeeString(env.initialAmountInPaise)
  );
  const [allocatedPaise, setAllocatedPaise] = useState(env.allocatedPaise);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAllocatedPaise(env.allocatedPaise);
  }, [env.allocatedPaise]);

  useEffect(() => {
    setFillValue(paiseToRupeeString(env.initialAmountInPaise));
  }, [env.initialAmountInPaise]);

  const handleQuickAdd = useCallback(() => {
    const amountPaise = rupeesToPaise(fillValue);
    if (amountPaise <= 0) return;
    const newPaise = allocatedPaise + amountPaise;
    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, newPaise);
      if ("error" in result) {
        toast.error(`Failed to add: ${result.error}`);
      } else {
        setAllocatedPaise(newPaise);
        onAllocatedChange(amountPaise);
        toast.success(`Added ₹${paiseToRupeeString(amountPaise)} to ${env.name}`);
      }
    });
  }, [fillValue, allocatedPaise, env.id, env.name, month, year, onAllocatedChange]);

  const handleQuickSet = useCallback(() => {
    const amountPaise = rupeesToPaise(fillValue);
    const delta = amountPaise - allocatedPaise;
    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, amountPaise);
      if ("error" in result) {
        toast.error(`Failed to set: ${result.error}`);
      } else {
        setAllocatedPaise(amountPaise);
        onAllocatedChange(delta);
        toast.success(`Set ${env.name} to ₹${paiseToRupeeString(amountPaise)}`);
      }
    });
  }, [fillValue, allocatedPaise, env.id, env.name, month, year, onAllocatedChange]);

  const currentAvailable = env.availablePaise - env.allocatedPaise + allocatedPaise;
  const isNegative = currentAvailable < 0;
  const progressPercent = allocatedPaise > 0 ? Math.min(100, Math.max(0, (env.spentPaise / allocatedPaise) * 100)) : 0;
  const isOverspent = env.spentPaise > allocatedPaise;

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_120px_100px] gap-2 sm:gap-2 items-stretch sm:items-center px-4 py-3 sm:py-2.5 hover:bg-muted/20 transition-colors group">
      <div className="flex items-center justify-between gap-2 sm:contents">
        <div className="flex flex-col gap-1 min-w-0 pr-0 sm:pr-4 flex-1">
          <span className="text-sm text-foreground font-medium truncate">{env.name}</span>
          <div className="flex flex-col gap-1 max-w-[200px] sm:max-w-[240px]">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Spent: {formatINR(env.spentPaise)}</span>
              <span>Allocated: {formatINR(allocatedPaise)}</span>
            </div>
            {allocatedPaise > 0 && (
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isOverspent ? "bg-negative" : progressPercent >= 90 ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end sm:contents">
          <div className="flex flex-col items-end gap-1.5 w-28 sm:w-32">
            <div className="relative w-full">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
              <input
                id={`fill-input-${env.id}`}
                type="number"
                min="0"
                step="0.01"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                disabled={isPending}
                className={cn(
                  "w-full rounded-md border border-input bg-background pl-5 sm:pl-6 pr-2 py-1 text-sm text-right",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                  "disabled:opacity-50 transition-opacity",
                  isPending && "opacity-60"
                )}
                aria-label={`Fill amount for ${env.name}`}
              />
            </div>
            <div className="flex gap-1.5">
              <Button
                onClick={handleQuickAdd}
                disabled={isPending || !fillValue || isNaN(parseFloat(fillValue)) || parseFloat(fillValue) <= 0}
                variant="outline"
                className="h-6 px-2 text-[10px] bg-background border-border hover:bg-muted text-foreground font-medium"
              >
                Add
              </Button>
              <Button
                onClick={handleQuickSet}
                disabled={isPending || !fillValue || isNaN(parseFloat(fillValue)) || parseFloat(fillValue) < 0}
                variant="outline"
                className="h-6 px-2 text-[10px] bg-background border-border hover:bg-muted text-foreground font-medium"
              >
                Set
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 sm:mt-0 sm:contents text-xs sm:text-sm">
        <div className="flex items-center gap-1 sm:block">
          <span className="text-muted-foreground sm:hidden">Spent: </span>
          <span className="text-muted-foreground text-right sm:block">
            {formatINR(env.spentPaise)}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:block">
          <span className="text-muted-foreground sm:hidden">Available: </span>
          <span className={cn("font-semibold text-right sm:block", isNegative ? "text-negative" : "text-positive")}>
            {formatINR(currentAvailable)}
          </span>
        </div>
      </div>
    </div>
  );
}

function GoalEnvelopeRow({
  env,
  month,
  year,
  onAllocatedChange,
}: {
  env: EnvelopeSetWithData["envelopes"][0];
  month: number;
  year: number;
  onAllocatedChange: (delta: number) => void;
}) {
  const [fillValue, setFillValue] = useState(
    paiseToRupeeString(env.initialAmountInPaise)
  );
  const [allocatedPaise, setAllocatedPaise] = useState(env.allocatedPaise);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAllocatedPaise(env.allocatedPaise);
  }, [env.allocatedPaise]);

  useEffect(() => {
    setFillValue(paiseToRupeeString(env.initialAmountInPaise));
  }, [env.initialAmountInPaise]);

  const handleQuickAdd = useCallback(() => {
    const amountPaise = rupeesToPaise(fillValue);
    if (amountPaise <= 0) return;
    const newPaise = allocatedPaise + amountPaise;
    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, newPaise);
      if ("error" in result) {
        toast.error(`Failed to add: ${result.error}`);
      } else {
        setAllocatedPaise(newPaise);
        onAllocatedChange(amountPaise);
        toast.success(`Added ₹${paiseToRupeeString(amountPaise)} to ${env.name}`);
      }
    });
  }, [fillValue, allocatedPaise, env.id, env.name, month, year, onAllocatedChange]);

  const handleQuickSet = useCallback(() => {
    const amountPaise = rupeesToPaise(fillValue);
    const delta = amountPaise - allocatedPaise;
    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, amountPaise);
      if ("error" in result) {
        toast.error(`Failed to set: ${result.error}`);
      } else {
        setAllocatedPaise(amountPaise);
        onAllocatedChange(delta);
        toast.success(`Set ${env.name} to ₹${paiseToRupeeString(amountPaise)}`);
      }
    });
  }, [fillValue, allocatedPaise, env.id, env.name, month, year, onAllocatedChange]);

  const currentAvailable = env.availablePaise - env.allocatedPaise + allocatedPaise;
  const target = env.goalAmountInPaise ?? 0;
  const progressPercent = target > 0 ? Math.min(100, Math.max(0, (currentAvailable / target) * 100)) : 0;

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_120px] gap-3 sm:gap-4 items-stretch sm:items-center px-4 py-3 hover:bg-muted/20 transition-colors group">
      <div className="flex flex-col gap-1 min-w-0 pr-0 sm:pr-4">
        <span className="text-sm text-foreground font-medium truncate">{env.name}</span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Saved: {formatINR(currentAvailable)}</span>
            {target > 0 && <span>Target: {formatINR(target)}</span>}
          </div>
          {target > 0 && (
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progressPercent >= 100 ? "bg-positive" : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:flex-col sm:justify-center sm:items-stretch gap-2">
        <span className="text-xs text-muted-foreground sm:hidden font-medium">Save This Month:</span>
        <div className="flex flex-col items-end gap-1.5 w-28 sm:w-full">
          <div className="relative w-full">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">₹</span>
            <input
              id={`goal-input-${env.id}`}
              type="number"
              min="0"
              step="0.01"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              disabled={isPending}
              className={cn(
                "w-full rounded-md border border-input bg-background pl-5 sm:pl-6 pr-2 py-1 text-sm text-right",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                "disabled:opacity-50 transition-opacity",
                isPending && "opacity-60"
              )}
              placeholder="0.00"
              aria-label={`Save amount for ${env.name}`}
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              onClick={handleQuickAdd}
              disabled={isPending || !fillValue || isNaN(parseFloat(fillValue)) || parseFloat(fillValue) <= 0}
              variant="outline"
              className="h-6 px-2 text-[10px] bg-background border-border hover:bg-muted text-foreground font-medium"
            >
              Add
            </Button>
            <Button
              onClick={handleQuickSet}
              disabled={isPending || !fillValue || isNaN(parseFloat(fillValue)) || parseFloat(fillValue) < 0}
              variant="outline"
              className="h-6 px-2 text-[10px] bg-background border-border hover:bg-muted text-foreground font-medium"
            >
              Set
            </Button>
          </div>
          <span className="hidden sm:block text-[10px] text-muted-foreground text-right mt-1">This month</span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:flex-col sm:justify-center sm:items-end gap-2 border-t border-dashed border-border/40 pt-2 sm:border-t-0 sm:pt-0 mt-1 sm:mt-0">
        <span className="text-xs text-muted-foreground sm:hidden font-medium">Total Saved:</span>
        <div className="flex flex-col items-end">
          <span className={cn("text-sm font-semibold", currentAvailable < 0 ? "text-negative" : "text-positive")}>
            {formatINR(currentAvailable)}
          </span>
          <span className="hidden sm:block text-[10px] text-muted-foreground mt-1">Total Saved</span>
        </div>
      </div>
    </div>
  );
}
