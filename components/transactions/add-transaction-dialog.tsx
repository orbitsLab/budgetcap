"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransaction } from "@/app/actions/transactions";
import type { AccountWithBalance } from "@/app/actions/accounts";
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
import { Loader2, Plus, RepeatIcon } from "lucide-react";
import { format } from "date-fns";

interface EnvelopeOption {
  id: string;
  name: string;
  setName: string;
}

interface AddTransactionDialogProps {
  householdId: string;
  envelopes: EnvelopeOption[];
  accounts: AccountWithBalance[];
  onSuccess?: () => void;
}

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

export function AddTransactionDialog({
  householdId,
  envelopes,
  accounts,
  onSuccess,
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [type, setType] = useState<TxType>("EXPENSE");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
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
      const result = await createTransaction({
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
        toast.success("Transaction added!");
        setOpen(false);
        resetForm();
        onSuccess?.();
      }
    });
  }

  function resetForm() {
    setType("EXPENSE");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setAmount("");
    setPayee("");
    setNotes("");
    setEnvelopeId("");
    setToEnvelopeId("");
    setAccountId("");
    setToAccountId("");
    setIsRecurring(false);
    setRecurringDay("1");
    setErrors({});
  }

  const typeColors: Record<TxType, string> = {
    INCOME: "text-positive",
    EXPENSE: "text-negative",
    TRANSFER: "text-primary",
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} id="add-transaction-btn">
        <Plus className="mr-2 h-4 w-4" />
        Add Transaction
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
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
                    id={`tx-type-${t.toLowerCase()}`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx-date">Date</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-amount">Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    id="tx-amount"
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
                <Label htmlFor="tx-account">
                  {type === "TRANSFER" ? "From Account" : "Account (Optional)"}
                </Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="tx-account">
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
                  <Label htmlFor="tx-to-account">To Account (Optional)</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger id="tx-to-account">
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
                <Label htmlFor="tx-envelope">
                  {type === "TRANSFER" ? "From Envelope" : "Envelope"}
                </Label>
                <Select value={envelopeId} onValueChange={setEnvelopeId}>
                  <SelectTrigger id="tx-envelope">
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
                <Label htmlFor="tx-to-envelope">To Envelope</Label>
                <Select value={toEnvelopeId} onValueChange={setToEnvelopeId}>
                  <SelectTrigger id="tx-to-envelope">
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
              <Label htmlFor="tx-payee">Payee</Label>
              <Input
                id="tx-payee"
                placeholder="e.g. Swiggy, Amazon..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-notes">Notes</Label>
              <Input
                id="tx-notes"
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
                id="tx-recurring-toggle"
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
                <Label htmlFor="tx-recurring-day">Day of month</Label>
                <Input
                  id="tx-recurring-day"
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
            <Button onClick={handleSubmit} disabled={isPending} id="tx-submit-btn">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
