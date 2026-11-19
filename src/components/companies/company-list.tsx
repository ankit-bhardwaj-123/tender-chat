"use client";

import type { Company } from "@/types";
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "@/lib/companies";
import { fontOf } from "@/shared/fonts";
import { CompanyDialog } from "./company-dialog";
import { DeleteCompanyDialog } from "./delete-company-dialog";

interface CompanyRowProps {
  company: Company;
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}

type RowAction = "edit" | "delete";

function filesSummary(company: Company): string {
  const { letterhead, seal } = company.files;
  if (letterhead && seal) return "Letterhead · Seal";
  if (letterhead) return "Letterhead · No seal";
  if (seal) return "Seal · No letterhead";
  return "No files yet";
}

function fontSummary(company: Company): string {
  const label = fontOf(company.fontKey).label;
  return company.fontKey === null ? `${label} (default)` : label;
}

export function companySummary(company: Company): string {
  return `${filesSummary(company)} · ${fontSummary(company)}`;
}

function CompanyRow({ company, onEdit, onDelete }: CompanyRowProps) {
  const pendingAction = useRef<RowAction | null>(null);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{company.name}</span>
        <span className="truncate text-xs text-muted-foreground">{companySummary(company)}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={`Actions for ${company.name}`} size="icon-sm">
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            const action = pendingAction.current;
            pendingAction.current = null;
            if (!action) return;
            event.preventDefault();
            if (action === "edit") onEdit(company);
            else onDelete(company);
          }}
        >
          <DropdownMenuItem onSelect={() => (pendingAction.current = "edit")}>
            <Pencil aria-hidden />
            Edit
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
    </li>
  );
}

export function CompanyList() {
  const companies = useCompanies();
  const [editing, setEditing] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [toDelete, setToDelete] = useState<Company | null>(null);

  const openDialog = (company: Company | null) => {
    setEditing(company);
    setDialogKey((key) => key + 1);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            The firms you quote from, with their letterhead and seal.
          </p>
        </div>
        <Button onClick={() => openDialog(null)} className="self-start">
          <Plus aria-hidden />
          Add company
        </Button>
      </div>

      {companies.isPending ? (
        <div role="status" aria-label="Loading companies" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : companies.isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted-foreground">{companies.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void companies.refetch()}>
            Retry
          </Button>
        </div>
      ) : companies.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-sm font-medium">No companies yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add a company with its letterhead PDF and seal JPG.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => openDialog(null)}>
            <Plus aria-hidden />
            Add company
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {companies.data.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              onEdit={openDialog}
              onDelete={setToDelete}
            />
          ))}
        </ul>
      )}

      <CompanyDialog key={dialogKey} open={open} onOpenChange={setOpen} company={editing} />
      <DeleteCompanyDialog
        company={toDelete}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
      />
    </div>
  );
}
