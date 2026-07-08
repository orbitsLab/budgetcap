"use client";

import { useState } from "react";
import { type AccountWithBalance, deleteAccount, setDefaultAccount } from "@/app/actions/accounts";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, Pencil, Trash2, CheckCircle2, Landmark } from "lucide-react";
import { AddAccountDialog } from "./add-account-dialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AccountsClientProps {
  householdId: string;
  accounts: AccountWithBalance[];
  totalBalance: number;
}

export function AccountsClient({
  householdId,
  accounts,
  totalBalance,
}: AccountsClientProps) {
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | undefined>();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleEdit = (account: AccountWithBalance) => {
    setEditingAccount(account);
    setIsEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this account?")) {
      const result = await deleteAccount(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Account deleted");
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    const result = await setDefaultAccount(householdId, id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Default account updated");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your physical and bank accounts
          </p>
        </div>
        <AddAccountDialog
          householdId={householdId}
          open={isEditOpen && !editingAccount}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingAccount(undefined);
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">
              Checking, Savings, Cash
            </h2>
          </div>
          <div className="font-semibold text-foreground text-sm">
            {formatINR(totalBalance)}
          </div>
        </div>

        {/* Accounts List */}
        <div className="divide-y divide-border">
          {accounts.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No accounts yet. Add one to start tracking balances.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <Landmark className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm flex items-center gap-2">
                      {acc.name}
                      {acc.isDefault && (
                        <span title="Default Account">
                          <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {acc.type.toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`font-medium text-sm ${
                      acc.balanceInPaise < 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatINR(acc.balanceInPaise)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-8 px-2"
                      >
                        Options
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(acc)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {!acc.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(acc.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(acc.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Total */}
        <div className="bg-muted/10 px-6 py-3 border-t border-border flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground">Total</span>
          <span className="font-semibold text-sm text-foreground">
            {formatINR(totalBalance)}
          </span>
        </div>
      </div>

      {editingAccount && (
        <AddAccountDialog
          householdId={householdId}
          accountToEdit={editingAccount}
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingAccount(undefined);
          }}
        />
      )}
    </div>
  );
}
