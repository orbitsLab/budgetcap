"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

import { createAccount, updateAccount, type AccountWithBalance } from "@/app/actions/accounts";
import { paiseToRupeeString, rupeesToPaise } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddAccountDialogProps {
  householdId: string;
  accountToEdit?: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({
  householdId,
  accountToEdit,
  open,
  onOpenChange,
}: AddAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"CHECKING" | "SAVINGS" | "CASH">("CHECKING");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [error, setError] = useState<string | null>(null);

  // Sync state if editing
  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setOpeningBalance(paiseToRupeeString(accountToEdit.openingBalanceInPaise));
    } else {
      setName("");
      setType("CHECKING");
      setOpeningBalance("0.00");
    }
    setError(null);
  }, [accountToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    const balanceFloat = parseFloat(openingBalance);
    if (isNaN(balanceFloat) || balanceFloat < 0) {
      setError("Valid opening balance is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const openingBalanceInPaise = rupeesToPaise(openingBalance);

      if (accountToEdit) {
        const result = await updateAccount(accountToEdit.id, {
          name: name.trim(),
          type,
          openingBalanceInPaise,
        });
        if ("error" in result) throw new Error(result.error);
        toast.success("Account updated successfully");
      } else {
        const result = await createAccount(
          householdId,
          name.trim(),
          type,
          openingBalanceInPaise
        );
        if ("error" in result) throw new Error(result.error);
        toast.success("Account created successfully");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!accountToEdit && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{accountToEdit ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chase Checking"
            />
            {error && !name.trim() && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select
              onValueChange={(val: any) => setType(val)}
              value={type}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHECKING">Checking</SelectItem>
                <SelectItem value="SAVINGS">Savings</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₹
              </span>
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            {error && (parseFloat(openingBalance) < 0 || isNaN(parseFloat(openingBalance))) && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Account"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
