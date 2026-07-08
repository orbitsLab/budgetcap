"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { updateTransaction } from "@/app/actions/transactions";
import type { AccountWithBalance } from "@/app/actions/accounts";
import type { TransactionWithRelations } from "@/app/actions/transactions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, RepeatIcon } from "lucide-react";
import { format } from "date-fns";

interface EnvelopeOption {
  id: string;
  name: string;
  setName: string;
}

interface EditTransactionDialogProps {
  transaction: TransactionWithRelations;
  householdId: string;
  envelopes: EnvelopeOption[];
  accounts: AccountWithBalance[];
  onSuccess?: () => void;
}

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

export function EditTransactionDialog({
  transaction,
  householdId,
  envelopes,
  accounts,
  onSuccess,
}: EditTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [type, setType] = useState<TxType>(transaction.type);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [notes, setNotes] = useState("");
  const [envelopeId, setEnvelopeId] = useState("");
  const [toEnvelopeId, setToEnvelopeId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState("1");

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync state when dialog opens or transaction changes
  useEffect(() => {
    if (open) {
      setType(transaction.type);
      setDate(format(new Date(transaction.date), "yyyy-MM-dd"));
      setAmount((transaction.amountInPaise / 100).toFixed(2));
      setPayee(transaction.payee ?? "");
      setNotes(transaction.notes ?? "");
      setEnvelopeId(transaction.envelopeId ?? "");
      setToEnvelopeId(transaction.toEnvelopeId ?? "");
      setAccountId(transaction.accountId ?? "none");
      setToAccountId(transaction.toAccountId ?? "none");
      setIsRecurring(transaction.isRecurring);
      setRecurringDay(transaction.recurringDayOfMonth?.toString() ?? "1");
      setErrors({});
    }
  }, [open, transaction]);

  function validate() {
    const e: Record<string, string> = {};
    const paise = Math.round(parseFloat(amount) * 100);
    if (!amount || isNaN(paise) || paise <= 0) e.amount = "Enter a valid positive amount";
    if (type !== "INCOME" && !envelopeId) e.envelope = "Select an envelope";
    if (type === "TRANSFER" && !toEnvelopeId && !toAccountId) e.toEnvelope = "Select a destination";
    if (type === "TRANSFER" && envelopeId === toEnvelopeId && accountId === toAccountId)
      e.toEnvelope = "Source and destination must differ";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const paise = Math.round(parseFloat(amount) * 100);

    startTransition(async () => {
      const result = await updateTransaction({
        id: transaction.id,
        householdId,
        type,
        date: new Date(date).toISOString(),
        amountInPaise: paise,
        payee: payee || undefined,
        notes: notes || undefined,
        envelopeId: type === "INCOME" ? null : envelopeId || null,
        toEnvelopeId: type === "TRANSFER" ? toEnvelopeId || null : null,
        accountId: !accountId || accountId === "none" ? null : accountId,
        toAccountId: type === "TRANSFER" && toAccountId !== "none" ? toAccountId || null : null,
        isRecurring,
        recurringDayOfMonth: isRecurring ? parseInt(recurringDay) : null,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Transaction updated!");
        setOpen(false);
        onSuccess?.();
      }
    });
  }

  const typeColors: Record<TxType, string> = {
    INCOME: "text-positive",
    EXPENSE: "text-negative",
    TRANSFER: "text-primary",
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Edit Transaction"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(["EXPENSE", "INCOME", "TRANSFER"] as TxType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                      type === t
                        ? `border-primary bg-primary/10 ${typeColors[t]}`
                        : "border-input hover:bg-muted/50"
                    }`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-date">Date</Label>
                <Input
                  id="edit-tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-amount">Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    id="edit-tx-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7"
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount}</p>
                )}
              </div>
            </div>

            {/* Account(s) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-account">
                  {type === "TRANSFER" ? "From Account" : "Account (Optional)"}
                </Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="edit-tx-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "TRANSFER" && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tx-to-account">To Account (Optional)</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger id="edit-tx-to-account">
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Envelope(s) */}
            {type !== "INCOME" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-envelope">
                  {type === "TRANSFER" ? "From Envelope" : "Envelope"}
                </Label>
                <Select value={envelopeId} onValueChange={setEnvelopeId}>
                  <SelectTrigger id="edit-tx-envelope">
                    <SelectValue placeholder="Select envelope" />
                  </SelectTrigger>
                  <SelectContent>
                    {envelopes.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.setName} → {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.envelope && (
                  <p className="text-xs text-destructive">{errors.envelope}</p>
                )}
              </div>
            )}

            {type === "TRANSFER" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-to-envelope">To Envelope</Label>
                <Select value={toEnvelopeId} onValueChange={setToEnvelopeId}>
                  <SelectTrigger id="edit-tx-to-envelope">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {envelopes
                      .filter((e) => e.id !== envelopeId)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.setName} → {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.toEnvelope && (
                  <p className="text-xs text-destructive">{errors.toEnvelope}</p>
                )}
              </div>
            )}

            {/* Payee + Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-tx-payee">Payee</Label>
              <Input
                id="edit-tx-payee"
                placeholder="e.g. Swiggy, Amazon..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tx-notes">Notes</Label>
              <Input
                id="edit-tx-notes"
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <RepeatIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Recurring</p>
                <p className="text-xs text-muted-foreground">Auto-generate each month</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                onClick={() => setIsRecurring((r) => !r)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isRecurring ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isRecurring ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {isRecurring && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-tx-recurring-day">Day of month</Label>
                <Input
                  id="edit-tx-recurring-day"
                  type="number"
                  min="1"
                  max="28"
                  value={recurringDay}
                  onChange={(e) => setRecurringDay(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
