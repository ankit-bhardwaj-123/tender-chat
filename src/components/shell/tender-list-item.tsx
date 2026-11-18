"use client";

import type { Tender } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useShell } from "./shell-context";

const NAME_MAX_LENGTH = 200;

function cleanName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return name.length === 0 || name.length > NAME_MAX_LENGTH ? null : name;
}

interface TenderListItemProps {
  tender: Tender;
  onDelete: (tender: Tender, trigger: HTMLElement) => void;
}

export function TenderListItem({ tender, onDelete }: TenderListItemProps) {
  const pathname = usePathname();
  const { onNavigate } = useShell();
  const queryClient = useQueryClient();
  const rename = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/tenders/${tender.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Something went wrong, please try again.");
      return (await res.json()) as Tender;
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ["tenders"] });
      const lists = queryClient.getQueriesData<Tender[]>({ queryKey: ["tenders"] });
      queryClient.setQueriesData<Tender[]>({ queryKey: ["tenders"] }, (list) =>
        list?.map((t) => (t.id === tender.id ? { ...t, name } : t)),
      );
      return { lists };
    },
    onError: (error, _name, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenders"] });
      void queryClient.invalidateQueries({ queryKey: ["tender", tender.id] });
    },
  });
  const [editing, setEditing] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const finished = useRef(false);
  const pendingAction = useRef<"rename" | "delete" | null>(null);
  const actionsRef = useRef<HTMLButtonElement>(null);

  const href = `/t/${tender.id}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  const stopEditing = (refocus: boolean) => {
    setEditing(false);
    if (refocus) requestAnimationFrame(() => linkRef.current?.focus());
  };

  const commit = (raw: string, refocus: boolean) => {
    stopEditing(refocus);
    const name = cleanName(raw);
    if (name === null || name === tender.name) return;
    rename.mutate(name);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      finished.current = true;
      commit(event.currentTarget.value, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finished.current = true;
      stopEditing(true);
    }
  };

  return (
    <li>
      <div
        data-active={active || undefined}
        className="group relative flex items-center rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:font-medium"
      >
        {editing ? (
          <input
            aria-label="Tender name"
            defaultValue={tender.name}
            maxLength={NAME_MAX_LENGTH}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={onKeyDown}
            onBlur={(e) => {
              if (finished.current) return;
              commit(e.currentTarget.value, false);
            }}
            className="m-0.5 h-8 min-w-0 flex-1 rounded-md border border-ring bg-card px-2 text-sm outline-none"
          />
        ) : (
          <Link
            ref={linkRef}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            title={tender.name}
            className="min-w-0 flex-1 truncate rounded-md px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tender.name}
          </Link>
        )}

        {!editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                ref={actionsRef}
                label={`Actions for ${tender.name}`}
                size="icon-sm"
                className="mr-1 shrink-0 group-hover:opacity-100 group-data-active:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:hover)]:opacity-0"
              >
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              onCloseAutoFocus={(event) => {
                const action = pendingAction.current;
                pendingAction.current = null;
                if (action === "rename") {
                  event.preventDefault();
                  finished.current = false;
                  setEditing(true);
                } else if (action === "delete" && actionsRef.current) {
                  const trigger = actionsRef.current;
                  requestAnimationFrame(() => onDelete(tender, trigger));
                }
              }}
            >
              <DropdownMenuItem onSelect={() => (pendingAction.current = "rename")}>
                <Pencil aria-hidden />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => (pendingAction.current = "delete")}
              >
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
