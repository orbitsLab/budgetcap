"use client";

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { saveAllocation } from "@/app/actions/budget";
import { formatINR, paiseToRupeeString, rupeesToPaise } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { EnvelopeSetWithData } from "@/app/actions/budget";

export function GoalEnvelopeRow({
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

      const newPaise = rupeesToPaise(newVal);
      const delta = newPaise - savedPaise;
      onAllocatedChange(delta);
    },
    [savedPaise, onAllocatedChange]
  );

  const handleSave = useCallback(() => {
    const newPaise = rupeesToPaise(inputValue);
    if (newPaise === savedPaise) return;

    startTransition(async () => {
      const result = await saveAllocation(env.id, month, year, newPaise);
      if ("error" in result) {
        toast.error(`Failed to save: ${result.error}`);
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
  const currentAvailable = env.availablePaise - env.allocatedPaise + currentPaise;
  
  // Calculate progress
  const target = env.goalAmountInPaise ?? 0;
  const progressPercent = target > 0 ? Math.min(100, Math.max(0, (currentAvailable / target) * 100)) : 0;

  return (
    <div className="grid grid-cols-[1fr_140px_120px] gap-4 items-center px-4 py-3 hover:bg-muted/20 transition-colors group">
      {/* Name and Progress Bar */}
      <div className="flex flex-col gap-1 min-w-0 pr-4">
        <span className="text-sm text-foreground font-medium truncate">{env.name}</span>
        {target > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Saved: {formatINR(currentAvailable)}</span>
              <span>Target: {formatINR(target)}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progressPercent >= 100 ? "bg-positive" : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Allocated input - How much to save this month */}
      <div className="flex flex-col justify-center">
        <div className="relative w-full">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            ₹
          </span>
          <input
            id={`goal-input-${env.id}`}
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
            placeholder="0.00"
            aria-label={`Save amount for ${env.name}`}
          />
        </div>
        <span className="text-[10px] text-muted-foreground text-right mt-1">This month</span>
      </div>

      {/* Available total */}
      <div className="flex flex-col justify-center items-end">
        <span
          className={cn(
            "text-sm font-semibold",
            currentAvailable < 0 ? "text-negative" : "text-positive"
          )}
        >
          {formatINR(currentAvailable)}
        </span>
        <span className="text-[10px] text-muted-foreground mt-1">Total Saved</span>
      </div>
    </div>
  );
}
