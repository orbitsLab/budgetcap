"use client";

import { useState, useTransition } from "react";
import { Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateEnvelopeSetSettings } from "@/app/actions/budget";
import type { AccountWithBalance } from "@/app/actions/accounts";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EnvelopeSetWithData } from "@/app/actions/budget";

interface EnvelopeSetSettingsProps {
  set: EnvelopeSetWithData;
  accounts: AccountWithBalance[];
}

export function EnvelopeSetSettings({ set, accounts }: EnvelopeSetSettingsProps) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>(set.accountId || "none");
  const [startsOnDay, setStartsOnDay] = useState<string>(set.startsOnDay.toString());
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const parsedDay = parseInt(startsOnDay, 10);
      const result = await updateEnvelopeSetSettings(set.id, {
        accountId: accountId === "none" ? null : accountId,
        startsOnDay: isNaN(parsedDay) ? 1 : parsedDay,
      });

      if ("error" in result) {
        toast.error(result.error as string);
      } else {
        toast.success("Settings updated");
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Settings for {set.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Settings: {set.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Linked Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="No account linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- No account linked --</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Link these envelopes to a specific bank account or cash.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Budget Starts On</Label>
            <Select value={startsOnDay} onValueChange={setStartsOnDay}>
              <SelectTrigger>
                <SelectValue placeholder="Day of month" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                    {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of the month
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
