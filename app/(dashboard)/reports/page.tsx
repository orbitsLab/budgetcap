import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Spending insights and trends</p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-16 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Spending trends by category, monthly comparisons, and more.
        </p>
      </div>
    </div>
  );
}
