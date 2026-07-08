"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTransaction } from "@/app/actions/transactions";
import type { TransactionWithRelations } from "@/app/actions/transactions";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, RepeatIcon, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { AddTransactionDialog } from "./add-transaction-dialog";

interface EnvelopeOption {
  id: string;
  name: string;
  setName: string;
}

interface TransactionsTableProps {
  transactions: TransactionWithRelations[];
  total: number;
  householdId: string;
  envelopes: EnvelopeOption[];
  initialFilters?: {
    envelopeId?: string;
    from?: string;
    to?: string;
  };
}

const TYPE_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" | "success" }> = {
  INCOME:   { label: "Income",   variant: "success" },
  EXPENSE:  { label: "Expense",  variant: "destructive" },
  TRANSFER: { label: "Transfer", variant: "outline" },
};

const PAGE_SIZE = 25;

export function TransactionsTable({
  transactions: initialTransactions,
  total: initialTotal,
  householdId,
  envelopes,
  initialFilters,
}: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(0);

  // Filters
  const [filterEnvelope, setFilterEnvelope] = useState(initialFilters?.envelopeId ?? "all");
  const [filterFrom, setFilterFrom] = useState(initialFilters?.from ?? "");
  const [filterTo, setFilterTo] = useState(initialFilters?.to ?? "");

  const totalPages = Math.ceil(initialTotal / PAGE_SIZE);

  function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    startTransition(async () => {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transaction deleted");
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="h-8 w-36 text-xs"
              id="filter-from-date"
              aria-label="From date"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="h-8 w-36 text-xs"
              id="filter-to-date"
              aria-label="To date"
            />
          </div>

          {/* Envelope filter */}
          <Select value={filterEnvelope} onValueChange={setFilterEnvelope}>
            <SelectTrigger className="h-8 w-48 text-xs" id="filter-envelope">
              <SelectValue placeholder="All envelopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All envelopes</SelectItem>
              {envelopes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.setName} → {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AddTransactionDialog householdId={householdId} envelopes={envelopes} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No transactions yet. Add one above!
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(tx.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {tx.payee ?? <span className="text-muted-foreground italic">—</span>}
                      {tx.isRecurring && (
                        <RepeatIcon
                          className="h-3.5 w-3.5 text-primary shrink-0"
                          aria-label="Recurring transaction"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {tx.type === "TRANSFER" ? (
                      <span className="text-muted-foreground">
                        {tx.envelope?.name ?? "—"} → {tx.toEnvelope?.name ?? "—"}
                      </span>
                    ) : (
                      tx.envelope?.name ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_LABELS[tx.type]?.variant ?? "outline"}>
                      {TYPE_LABELS[tx.type]?.label ?? tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {tx.notes ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold text-sm tabular-nums",
                      tx.type === "INCOME"
                        ? "text-positive"
                        : tx.type === "EXPENSE"
                        ? "text-negative"
                        : "text-foreground"
                    )}
                  >
                    {tx.type === "EXPENSE" ? "−" : "+"}
                    {formatINR(tx.amountInPaise)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(tx.id)}
                      disabled={isPending}
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {initialTotal} transactions
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
