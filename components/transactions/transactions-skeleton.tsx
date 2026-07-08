import { Skeleton } from "@/components/ui/skeleton";

export function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters bar skeleton */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36 ml-auto" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-border">
          {["Date", "Payee", "Envelope", "Type", "Notes", "Amount", ""].map(
            (h, i) => (
              <Skeleton key={i} className={`h-4 ${i === 5 ? "ml-auto w-16" : "w-20"}`} />
            )
          )}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-7 gap-4 items-center px-4 py-3.5 border-b border-border last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-7 w-7" />
          </div>
        ))}
      </div>
    </div>
  );
}
