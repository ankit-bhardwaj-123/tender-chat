"use client";

import type { Tender } from "@/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen, PanelLeftClose, Plus, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/lib/hooks";
import { DeleteTenderDialog } from "./delete-tender-dialog";
import { NewTenderDialog } from "./new-tender-dialog";
import { useShell } from "./shell-context";
import { TenderListItem } from "./tender-list-item";
import { UserMenu } from "./user-menu";

const SEARCH_DEBOUNCE_MS = 250;

export function Sidebar() {
  const { isDesktop, toggleSidebar } = useShell();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS).trim();
  const tenders = useQuery({
    queryKey: ["tenders", query],
    queryFn: async () => {
      const url = query ? `/api/tenders?search=${encodeURIComponent(query)}` : "/api/tenders";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't load your tenders.");
      return (await res.json()) as Tender[];
    },
    placeholderData: keepPreviousData,
  });
  const [deleting, setDeleting] = useState<{ tender: Tender; trigger: HTMLElement } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const askToDelete = useCallback((tender: Tender, trigger: HTMLElement) => {
    setDeleting({ tender, trigger });
    setDeleteOpen(true);
  }, []);

  const list = () => {
    if (tenders.isPending) {
      return (
        <div role="status" aria-label="Loading…" className="flex flex-col gap-2 p-2">
          {[70, 90, 60, 80, 75].map((width, i) => (
            <Skeleton key={i} className="h-7" style={{ width: `${width}%` }} />
          ))}
        </div>
      );
    }
    if (tenders.isError) {
      return (
        <div role="alert" className="flex flex-col items-start gap-2 p-3 text-sm">
          <p className="text-muted-foreground">{"Couldn't load your tenders."}</p>
          <Button variant="outline" size="sm" onClick={() => void tenders.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (tenders.data.length === 0) {
      return query ? (
        <p className="p-3 text-sm text-muted-foreground">No tenders match “{query}”</p>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <FolderOpen className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No tenders yet</p>
          <p className="text-xs text-muted-foreground">Start a new tender to make its quotation.</p>
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-0.5 px-1.5 py-2">
        {tenders.data.map((tender) => (
          <TenderListItem key={tender.id} tender={tender} onDelete={askToDelete} />
        ))}
      </ul>
    );
  };

  return (
    <nav aria-label="Tenders" className="flex h-full min-h-0 flex-col bg-sidebar">
      {isDesktop && (
        <div className="flex h-14 shrink-0 items-center justify-end px-3">
          <IconButton label="Hide sidebar" size="icon-sm" onClick={toggleSidebar}>
            <PanelLeftClose />
          </IconButton>
        </div>
      )}

      <div className={`flex shrink-0 flex-col gap-2 px-3 pb-2 ${isDesktop ? "" : "pt-3"}`}>
        <Button
          variant="outline"
          className="h-9 w-full justify-start gap-2 bg-card"
          onClick={() => setNewOpen(true)}
        >
          <Plus aria-hidden />
          New tender
        </Button>
        <NewTenderDialog open={newOpen} onOpenChange={setNewOpen} />
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && search) {
                e.stopPropagation();
                setSearch("");
              }
            }}
            placeholder="Search tenders"
            aria-label="Search tenders"
            className="h-9 bg-card pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{list()}</div>

      <div className="shrink-0 border-t border-sidebar-border p-1.5">
        <UserMenu />
      </div>

      {deleting && (
        <DeleteTenderDialog
          tender={deleting.tender}
          returnFocusTo={deleting.trigger}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </nav>
  );
}
