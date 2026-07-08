"use client";

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { saveAllocation } from "@/app/actions/budget";
import { formatINR, paiseToRupeeString, rupeesToPaise } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnvelopeSetWithData } from "@/app/actions/budget";

interface EnvelopeSetListProps {
  envelopeSets: EnvelopeSetWithData[];
  month: number;
  year: number;
  onAllocatedChange: (delta: number) => void; // for optimistic ToBudget update
}

export function EnvelopeSetList({
  envelopeSets,
  month,
  year,
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
  onAllocatedChange,
}: {
  set: EnvelopeSetWithData;
  month: number;
  year: number;
  onAllocatedChange: (delta: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const setAllocated = set.envelopes.reduce((s, e) => s + e.allocatedPaise, 0);
  const setSpent = set.envelopes.reduce((s, e) => s + e.spentPaise, 0);
  const setAvailable = set.envelopes.reduce((s, e) => s + e.availablePaise, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Set header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        aria-expanded={!collapsed}
        id={`envelope-set-${set.id}-toggle`}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm text-foreground">{set.name}</span>
          <span className="text-xs text-muted-foreground">
            ({set.envelopes.length})
          </span>
        </div>
        {/* Set totals */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground pr-2">
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

      {/* Envelope rows */}
      {!collapsed && (
        <div className="divide-y divide-border border-t border-border">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_140px_120px_100px] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
            <span>Envelope</span>
            <span className="text-right">Allocated (₹)</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Available</span>
          </div>

          {set.envelopes.map((env) => (
            <EnvelopeRow
              key={env.id}
              env={env}
              month={month}
              year={year}
              onAllocatedChange={onAllocatedChange}
            />
          ))}
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
  const [inputValue, setInputValue] = useState(
    paiseToRupeeString(env.allocatedPaise)
  );
  const [savedPaise, setSavedPaise] = useState(env.allocatedPaise);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setInputValue(newVal);

      // Optimistic update: notify parent of the delta for "To Budget" recalculation
      const newPaise = rupeesToPaise(newVal);
      const delta = newPaise - savedPaise;
      onAllocatedChange(delta);
    },
    [savedPaise, onAllocatedChange]
  );

  const handleSave = useCallback(() => {
    const newPaise = rupeesToPaise(inputValue);
    if (newPaise === savedPaise) return; // no change

    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, newPaise);
      if ("error" in result) {
        toast.error(`Failed to save: ${result.error}`);
        // Revert
        setInputValue(paiseToRupeeString(savedPaise));
        const revertDelta = savedPaise - newPaise;
        onAllocatedChange(revertDelta);
      } else {
        setSavedPaise(newPaise);
        setInputValue(paiseToRupeeString(newPaise));
        toast.success(`Saved allocation for ${env.name}`);
      }
    });
  }, [inputValue, savedPaise, env.id, env.name, month, year, onAllocatedChange]);

  const currentPaise = rupeesToPaise(inputValue);
  const currentAvailable =
    env.availablePaise - env.allocatedPaise + currentPaise;
  const isNegative = currentAvailable < 0;

  return (
    <div className="grid grid-cols-[1fr_140px_120px_100px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors group">
      {/* Name */}
      <span className="text-sm text-foreground font-medium truncate">{env.name}</span>

      {/* Allocated input */}
      <div className="flex items-center justify-end">
        <div className="relative w-32">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            ₹
          </span>
          <input
            id={`allocation-input-${env.id}`}
            type="number"
            min="0"
            step="0.01"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            disabled={isPending}
            className={cn(
              "w-full rounded-md border border-input bg-background pl-6 pr-2 py-1.5 text-sm text-right",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:opacity-50 transition-opacity",
              isPending && "opacity-60"
            )}
            aria-label={`Allocation for ${env.name}`}
          />
        </div>
      </div>

      {/* Spent */}
      <span className="text-sm text-right text-muted-foreground">
        {formatINR(env.spentPaise)}
      </span>

      {/* Available */}
      <span
        className={cn(
          "text-sm text-right font-semibold",
          isNegative ? "text-negative" : "text-positive"
        )}
      >
        {formatINR(currentAvailable)}
      </span>
    </div>
  );
}
