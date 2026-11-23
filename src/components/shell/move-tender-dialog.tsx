"use client";

import type { Tender } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Folder, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllTenders } from "@/lib/tenders";
import { descendantIds, treeRows } from "@/shared/folder-tree";

const INDENT_PX = 16;

interface MoveTenderDialogProps {
  tender: Tender;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MoveTarget {
  id: string;
  name: string;
  depth: number;
}

export function MoveTenderDialog({ tender, open, onOpenChange }: MoveTenderDialogProps) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const all = useAllTenders(open);
  const move = useMutation({
    mutationFn: async (parentId: string) => {
      const res = await fetch(`/api/tenders/${tender.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = body?.error?.message;
        throw new Error(
          res.status === 400 && message ? message : "Something went wrong, please try again.",
        );
      }
      return (await res.json()) as Tender;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tenders"] }),
  });

  const targets = useMemo<MoveTarget[]>(() => {
    const rows = all.data ?? [];
    const blocked = descendantIds(rows, tender.id);
    blocked.add(tender.id);
    const open = new Set(rows.map((row) => row.id));
    return treeRows(rows, open)
      .filter((row) => !blocked.has(row.item.id))
      .map((row) => ({ id: row.item.id, name: row.item.name, depth: row.depth }));
  }, [all.data, tender.id]);

  const changeOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) setPicked(null);
  };

  const pickedTarget = targets.find((target) => target.id === picked) ?? null;

  const submit = () => {
    if (!pickedTarget) return;
    move.mutate(pickedTarget.id, {
      onSuccess: () => {
        toast.success(`Moved to ${pickedTarget.name}.`);
        changeOpen(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const list = () => {
    if (all.isPending) {
      return (
        <div role="status" aria-label="Loading…" className="flex flex-col gap-2 p-2">
          {[70, 90, 60].map((width, i) => (
            <Skeleton key={i} className="h-7" style={{ width: `${width}%` }} />
          ))}
        </div>
      );
    }
    if (all.isError) {
      return (
        <div role="alert" className="flex flex-col items-start gap-2 p-3 text-sm">
          <p className="text-muted-foreground">{"Couldn't load your tenders."}</p>
          <Button variant="outline" size="sm" onClick={() => void all.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (targets.length === 0) {
      return <p className="p-3 text-sm text-muted-foreground">No other folders to move into.</p>;
    }
    return (
      <ul role="listbox" aria-label="Move to" className="flex flex-col gap-0.5 p-1">
        {targets.map((target) => {
          const here = target.id === tender.parentId;
          const selected = picked === target.id;
          const main = target.depth === 0;
          return (
            <li key={target.id} className={main ? "mt-1 first:mt-0" : undefined}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={here}
                onClick={() => setPicked(target.id)}
                style={{ paddingLeft: `${8 + target.depth * INDENT_PX}px` }}
                className={`flex w-full items-center gap-2 rounded-md pr-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent aria-selected:bg-accent aria-selected:ring-1 aria-selected:ring-primary/40 ${
                  main
                    ? "bg-muted/70 py-2 text-sm font-semibold text-foreground"
                    : "py-1.5 text-[13px] text-muted-foreground aria-selected:text-foreground"
                }`}
              >
                {main ? (
                  <Folder className="size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate" title={target.name}>
                  {target.name}
                </span>
                {here && <span className="text-xs font-normal">(here)</span>}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogTitle className="text-base font-semibold">Move “{tender.name}” to…</DialogTitle>
        <div className="max-h-80 overflow-y-auto rounded-lg border bg-card">{list()}</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" disabled={!pickedTarget || move.isPending} onClick={submit}>
            {move.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
