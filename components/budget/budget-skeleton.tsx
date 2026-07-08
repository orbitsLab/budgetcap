import { Skeleton } from "@/components/ui/skeleton";

export function BudgetSkeleton() {
  return (
    <div className="space-y-6">
      {/* ToBudget bar skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
        <div className="mt-5 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>

      {/* Envelope set skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 hidden sm:block" />
          </div>
          <div className="divide-y divide-border border-t border-border">
            <div className="grid grid-cols-[1fr_140px_120px_100px] gap-2 px-4 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16 ml-auto" />
              <Skeleton className="h-3 w-16 ml-auto" />
              <Skeleton className="h-3 w-14 ml-auto" />
            </div>
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="grid grid-cols-[1fr_140px_120px_100px] gap-2 items-center px-4 py-2.5"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-32 ml-auto rounded-md" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
