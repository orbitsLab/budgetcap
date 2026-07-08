"use client";

import { useState } from "react";
import { ToBudgetBar } from "@/components/budget/to-budget-bar";
import { EnvelopeSetList } from "@/components/budget/envelope-set-list";
import type { EnvelopeSetWithData } from "@/app/actions/budget";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface BudgetClientProps {
  envelopeSets: EnvelopeSetWithData[];
  totalIncomePaise: number;
  month: number;
  year: number;
}

export function BudgetClient({
  envelopeSets,
  totalIncomePaise,
  month,
  year,
}: BudgetClientProps) {
  // Optimistic total allocated — starts from actual DB values
  const initialAllocated = envelopeSets
    .flatMap((s) => s.envelopes)
    .reduce((sum, e) => sum + e.allocatedPaise, 0);

  const [optimisticAllocated, setOptimisticAllocated] =
    useState(initialAllocated);

  const handleAllocatedChange = (delta: number) => {
    setOptimisticAllocated((prev) => prev + delta);
  };

  const monthName = new Date(year, month - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budget</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthName}</p>
        </div>
        <Button asChild size="sm" variant="outline" id="manage-envelopes-btn">
          <Link href="/envelopes">
            <Plus className="mr-1.5 h-4 w-4" />
            Manage Envelopes
          </Link>
        </Button>
      </div>

      {/* To Budget bar */}
      <ToBudgetBar
        totalIncomePaise={totalIncomePaise}
        totalAllocatedPaise={optimisticAllocated}
      />

      {/* Envelope sets */}
      <EnvelopeSetList
        envelopeSets={envelopeSets}
        month={month}
        year={year}
        onAllocatedChange={handleAllocatedChange}
      />
    </div>
  );
}
