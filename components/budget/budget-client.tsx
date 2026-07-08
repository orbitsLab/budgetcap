"use client";

import { useState, useTransition } from "react";
import { ToBudgetBar } from "@/components/budget/to-budget-bar";
import { EnvelopeSetList } from "@/components/budget/envelope-set-list";
import type { EnvelopeSetWithData } from "@/app/actions/budget";
import { fillAllEnvelopes } from "@/app/actions/budget";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import type { AccountWithBalance } from "@/app/actions/accounts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface BudgetClientProps {
  envelopeSets: EnvelopeSetWithData[];
  totalIncomePaise: number;
  month: number;
  year: number;
  accounts: AccountWithBalance[];
}

export function BudgetClient({
  envelopeSets,
  totalIncomePaise,
  month,
  year,
  accounts,
}: BudgetClientProps) {
  const initialAllocated = envelopeSets
    .flatMap((s) => s.envelopes)
    .reduce((sum, e) => sum + e.allocatedPaise, 0);

  const [optimisticAllocated, setOptimisticAllocated] = useState(initialAllocated);
  const [isPending, startTransition] = useTransition();

  const handleAllocatedChange = (delta: number) => {
    setOptimisticAllocated((prev) => prev + delta);
  };

  const handleGlobalFill = (mode: "add" | "set") => {
    const envelopeIds = envelopeSets.flatMap((s) => s.envelopes).map((e) => e.id);
    if (envelopeIds.length === 0) {
      toast.error("No envelopes to fill.");
      return;
    }

    startTransition(async () => {
      const result = await fillAllEnvelopes(envelopeIds, month, year, mode);
      if ("error" in result) {
        toast.error(`Failed to fill envelopes: ${result.error}`);
      } else {
        toast.success(`Envelopes successfully filled!`);
        // Recalculate total allocated based on initialAmountInPaise and mode
        const newAllocated = envelopeSets
          .flatMap((s) => s.envelopes)
          .reduce((sum, e) => {
            const existing = e.allocatedPaise;
            const initial = e.initialAmountInPaise;
            return sum + (mode === "add" ? existing + initial : initial);
          }, 0);
        setOptimisticAllocated(newAllocated);
      }
    });
  };

  const monthName = new Date(year, month - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budget</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthName}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isPending} id="fill-envelopes-dropdown">
                {isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Fill Envelopes
                <ChevronDown className="ml-1.5 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleGlobalFill("add")} className="text-sm">
                Add Monthly Budgets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGlobalFill("set")} className="text-sm">
                Set Monthly Budgets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild size="sm" variant="outline" id="manage-envelopes-btn">
            <Link href="/envelopes">
              Manage Envelopes
            </Link>
          </Button>
        </div>
      </div>

      <ToBudgetBar
        totalIncomePaise={totalIncomePaise}
        totalAllocatedPaise={optimisticAllocated}
      />

      <EnvelopeSetList
        envelopeSets={envelopeSets}
        month={month}
        year={year}
        accounts={accounts}
        onAllocatedChange={handleAllocatedChange}
      />
    </div>
  );
}
