"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createEnvelopeSet,
  updateEnvelopeSet,
  deleteEnvelopeSet,
  createEnvelope,
  updateEnvelope,
  deleteEnvelope,
  archiveEnvelope,
  reorderEnvelopeSets,
  reorderEnvelopes,
  toggleGoal,
} from "@/app/actions/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronUp,
  ChevronDown,
  Loader2,
  FolderPlus,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvelopeData {
  id: string;
  name: string;
  isArchived: boolean;
  position: number;
  isGoal?: boolean;
  goalAmountInPaise?: number | null;
  initialAmountInPaise?: number;
}

interface EnvelopeSetData {
  id: string;
  name: string;
  position: number;
  envelopes: EnvelopeData[];
}

interface EnvelopesClientProps {
  householdId: string;
  initialSets: EnvelopeSetData[];
}

export function EnvelopesClient({ householdId, initialSets }: EnvelopesClientProps) {
  const [sets, setSets] = useState<EnvelopeSetData[]>(initialSets);
  const [isPending, startTransition] = useTransition();

  // ── Dialog state ──
  const [newSetName, setNewSetName] = useState("");
  const [showNewSetDialog, setShowNewSetDialog] = useState(false);
  const [editingSet, setEditingSet] = useState<EnvelopeSetData | null>(null);
  const [editSetName, setEditSetName] = useState("");

  const [showNewEnvDialog, setShowNewEnvDialog] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvInitialAmount, setNewEnvInitialAmount] = useState("");
  const [newEnvSetId, setNewEnvSetId] = useState<string>("");
  const [editingEnv, setEditingEnv] = useState<EnvelopeData | null>(null);
  const [editEnvName, setEditEnvName] = useState("");
  const [editEnvInitialAmount, setEditEnvInitialAmount] = useState("");

  const [goalEnv, setGoalEnv] = useState<EnvelopeData | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [isGoalEnabled, setIsGoalEnabled] = useState(false);

  // ── Envelope Set Actions ──
  function handleCreateSet() {
    if (!newSetName.trim()) return;
    startTransition(async () => {
      const r = await createEnvelopeSet(householdId, newSetName.trim());
      if ("error" in r) {
        toast.error(r.error);
      } else {
        toast.success("Envelope set created");
        setShowNewSetDialog(false);
        setNewSetName("");
        if (r.id) {
          setSets((prev) => [
            ...prev,
            { id: r.id, name: newSetName.trim(), position: prev.length, envelopes: [] },
          ]);
        }
      }
    });
  }

  function handleUpdateSet() {
    if (!editingSet || !editSetName.trim()) return;
    startTransition(async () => {
      await updateEnvelopeSet(editingSet.id, editSetName.trim());
      toast.success("Updated");
      setSets((prev) =>
        prev.map((s) => (s.id === editingSet.id ? { ...s, name: editSetName.trim() } : s))
      );
      setEditingSet(null);
    });
  }

  function handleDeleteSet(id: string) {
    if (!confirm("Delete this envelope set and ALL its envelopes? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteEnvelopeSet(id);
      toast.success("Deleted");
      setSets((prev) => prev.filter((s) => s.id !== id));
    });
  }

  function moveSet(index: number, dir: -1 | 1) {
    const newSets = [...sets];
    const swap = newSets[index + dir];
    newSets[index + dir] = { ...newSets[index], position: index + dir };
    newSets[index] = { ...swap, position: index };
    setSets(newSets);
    startTransition(async () => {
      await reorderEnvelopeSets(newSets.map((s, i) => ({ id: s.id, position: i })));
    });
  }

  // ── Envelope Actions ──
  function handleCreateEnvelope() {
    if (!newEnvName.trim() || !newEnvSetId) return;
    const initialPaise = Math.round(parseFloat(newEnvInitialAmount || "0") * 100);
    startTransition(async () => {
      const r = await createEnvelope(newEnvSetId, newEnvName.trim(), initialPaise);
      if ("error" in r) {
        toast.error(r.error);
      } else {
        toast.success("Envelope created");
        setShowNewEnvDialog(false);
        setNewEnvName("");
        setNewEnvInitialAmount("");
        if (r.id) {
          setSets((prev) =>
            prev.map((s) =>
              s.id === newEnvSetId
                ? {
                    ...s,
                    envelopes: [
                      ...s.envelopes,
                      {
                        id: r.id,
                        name: newEnvName.trim(),
                        isArchived: false,
                        position: s.envelopes.length,
                        initialAmountInPaise: initialPaise,
                      },
                    ],
                  }
                : s
            )
          );
        }
      }
    });
  }

  function handleUpdateEnvelope() {
    if (!editingEnv || !editEnvName.trim()) return;
    const initialPaise = Math.round(parseFloat(editEnvInitialAmount || "0") * 100);
    startTransition(async () => {
      await updateEnvelope(editingEnv.id, editEnvName.trim(), initialPaise);
      toast.success("Updated");
      setSets((prev) =>
        prev.map((s) => ({
          ...s,
          envelopes: s.envelopes.map((e) =>
            e.id === editingEnv.id
              ? { ...e, name: editEnvName.trim(), initialAmountInPaise: initialPaise }
              : e
          ),
        }))
      );
      setEditingEnv(null);
    });
  }

  function handleDeleteEnvelope(envId: string) {
    if (!confirm("Delete this envelope? All its transactions will lose the envelope link.")) return;
    startTransition(async () => {
      await deleteEnvelope(envId);
      toast.success("Deleted");
      setSets((prev) =>
        prev.map((s) => ({
          ...s,
          envelopes: s.envelopes.filter((e) => e.id !== envId),
        }))
      );
    });
  }

  function handleArchiveEnvelope(env: EnvelopeData) {
    startTransition(async () => {
      await archiveEnvelope(env.id, !env.isArchived);
      toast.success(env.isArchived ? "Restored" : "Archived");
      setSets((prev) =>
        prev.map((s) => ({
          ...s,
          envelopes: s.envelopes.map((e) =>
            e.id === env.id ? { ...e, isArchived: !e.isArchived } : e
          ),
        }))
      );
    });
  }

  function moveEnvelope(setId: string, envIndex: number, dir: -1 | 1) {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    const envs = [...set.envelopes];
    const swap = envs[envIndex + dir];
    envs[envIndex + dir] = { ...envs[envIndex], position: envIndex + dir };
    envs[envIndex] = { ...swap, position: envIndex };
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, envelopes: envs } : s)));
    startTransition(async () => {
      await reorderEnvelopes(envs.map((e, i) => ({ id: e.id, position: i })));
    });
  }

  function handleSaveGoal() {
    if (!goalEnv) return;
    startTransition(async () => {
      const parsedAmount = Math.round(parseFloat(goalAmount || "0") * 100);
      await toggleGoal(goalEnv.id, isGoalEnabled, parsedAmount > 0 ? parsedAmount : null);
      toast.success("Goal settings saved");
      setSets((prev) =>
        prev.map((s) => ({
          ...s,
          envelopes: s.envelopes.map((e) =>
            e.id === goalEnv.id
              ? { ...e, isGoal: isGoalEnabled, goalAmountInPaise: parsedAmount }
              : e
          ),
        }))
      );
      setGoalEnv(null);
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Envelopes</h1>
          <p className="text-sm text-muted-foreground">
            Manage your budget categories
          </p>
        </div>
        <Button
          onClick={() => setShowNewSetDialog(true)}
          id="create-envelope-set-btn"
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          New Set
        </Button>
      </div>

      {/* Envelope sets */}
      {sets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <FolderPlus className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            No envelope sets yet. Create your first one!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sets.map((set, si) => (
            <div
              key={set.id}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Set header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border min-w-0">
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveSet(si, -1)}
                    disabled={si === 0 || isPending}
                    aria-label="Move set up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveSet(si, 1)}
                    disabled={si === sets.length - 1 || isPending}
                    aria-label="Move set down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <span className="flex-1 font-semibold text-sm text-foreground truncate min-w-0">
                  {set.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingSet(set);
                      setEditSetName(set.name);
                    }}
                    aria-label={`Edit set ${set.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteSet(set.id)}
                    disabled={isPending}
                    aria-label={`Delete set ${set.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setNewEnvSetId(set.id);
                      setShowNewEnvDialog(true);
                    }}
                    aria-label={`Add envelope to ${set.name}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Envelopes list */}
              {set.envelopes.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground text-center">
                  No envelopes yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {set.envelopes.map((env, ei) => (
                    <li
                      key={env.id}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors min-w-0",
                        env.isArchived && "opacity-50"
                      )}
                    >
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveEnvelope(set.id, ei, -1)}
                          disabled={ei === 0 || isPending}
                          aria-label="Move envelope up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveEnvelope(set.id, ei, 1)}
                          disabled={ei === set.envelopes.length - 1 || isPending}
                          aria-label="Move envelope down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm text-foreground truncate">
                          {env.name}
                          {env.isArchived && (
                            <span className="ml-2 text-xs text-muted-foreground italic">
                              (archived)
                            </span>
                          )}
                        </span>
                        {!!env.initialAmountInPaise && (
                          <span className="text-[11px] text-muted-foreground">
                            Monthly: ₹{(env.initialAmountInPaise / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingEnv(env);
                            setEditEnvName(env.name);
                            setEditEnvInitialAmount(
                              env.initialAmountInPaise
                                ? (env.initialAmountInPaise / 100).toFixed(2)
                                : ""
                            );
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7", env.isGoal ? "text-primary" : "")}
                          onClick={() => {
                            setGoalEnv(env);
                            setIsGoalEnabled(env.isGoal || false);
                            setGoalAmount(env.goalAmountInPaise ? (env.goalAmountInPaise / 100).toFixed(2) : "");
                          }}
                          title="Goal Settings"
                        >
                          <Target className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleArchiveEnvelope(env)}
                          disabled={isPending}
                          title={env.isArchived ? "Restore" : "Archive"}
                        >
                          {env.isArchived ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEnvelope(env.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* New Envelope Set */}
      <Dialog open={showNewSetDialog} onOpenChange={setShowNewSetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Envelope Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              id="new-set-name-input"
              placeholder="e.g. Monthly Bills"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSet()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSet} disabled={isPending || !newSetName.trim()} id="create-set-confirm-btn">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Envelope Set */}
      <Dialog open={!!editingSet} onOpenChange={(o) => !o && setEditingSet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Envelope Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              id="edit-set-name-input"
              value={editSetName}
              onChange={(e) => setEditSetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateSet()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSet(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSet} disabled={isPending} id="save-set-btn">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Envelope */}
      <Dialog open={showNewEnvDialog} onOpenChange={(o) => { setShowNewEnvDialog(o); if (!o) { setNewEnvName(""); setNewEnvInitialAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Envelope</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                id="new-envelope-name-input"
                placeholder="e.g. Rent"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Monthly Amount
                <span className="ml-1 text-xs text-muted-foreground font-normal">(default fill amount)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  id="new-envelope-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newEnvInitialAmount}
                  onChange={(e) => setNewEnvInitialAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateEnvelope()}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewEnvDialog(false); setNewEnvName(""); setNewEnvInitialAmount(""); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateEnvelope} disabled={isPending || !newEnvName.trim()} id="create-envelope-confirm-btn">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Envelope */}
      <Dialog open={!!editingEnv} onOpenChange={(o) => !o && setEditingEnv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Envelope</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                id="edit-envelope-name-input"
                value={editEnvName}
                onChange={(e) => setEditEnvName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateEnvelope()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Monthly Amount
                <span className="ml-1 text-xs text-muted-foreground font-normal">(default fill amount)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  id="edit-envelope-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editEnvInitialAmount}
                  onChange={(e) => setEditEnvInitialAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateEnvelope()}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEnv(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEnvelope} disabled={isPending} id="save-envelope-btn">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit Goal Settings */}
      <Dialog open={!!goalEnv} onOpenChange={(o) => !o && setGoalEnv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Goal Settings: {goalEnv?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-goal-checkbox"
                checked={isGoalEnabled}
                onChange={(e) => setIsGoalEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="is-goal-checkbox" className="text-sm font-medium">
                Make this a savings goal
              </label>
            </div>
            
            {isGoalEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    className="pl-7"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalEnv(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGoal} disabled={isPending}>
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
