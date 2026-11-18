"use client";

import type { Template } from "@/types";
import { ExternalLink, FileCode2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import { languageLabel, templateFileUrl, useTemplates } from "@/lib/templates";
import { DeleteTemplateDialog } from "./delete-template-dialog";
import { TemplateDialog } from "./template-dialog";

interface TemplateRowProps {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
}

type RowAction = "edit" | "delete";

function TemplateRow({ template, onEdit, onDelete }: TemplateRowProps) {
  const pendingAction = useRef<RowAction | null>(null);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileCode2 className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{template.name}</span>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {languageLabel(template.language)}
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">{template.fileName}</span>
        {template.placeholders.length > 0 ? (
          <span className="text-xs break-words text-blue-600 dark:text-blue-400">
            {template.placeholders.join(" · ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No placeholders</span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={`Actions for ${template.name}`} size="icon-sm">
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
            if (action === "edit") onEdit(template);
            else onDelete(template);
          }}
        >
          <DropdownMenuItem asChild>
            <a href={templateFileUrl(template)} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              View
            </a>
          </DropdownMenuItem>
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

export function TemplateList() {
  const templates = useTemplates();
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [toDelete, setToDelete] = useState<Template | null>(null);

  const openDialog = (template: Template | null) => {
    setEditing(template);
    setDialogKey((key) => key + 1);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            The quotation layouts you fill in, with their placeholders.
          </p>
        </div>
        <Button onClick={() => openDialog(null)} className="self-start">
          <Plus aria-hidden />
          Add template
        </Button>
      </div>

      {templates.isPending ? (
        <div role="status" aria-label="Loading templates" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : templates.isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted-foreground">{templates.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void templates.refetch()}>
            Retry
          </Button>
        </div>
      ) : templates.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileCode2 className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-sm font-medium">No templates yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {"Add a template with its name, language and HTML layout."}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => openDialog(null)}>
            <Plus aria-hidden />
            Add template
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {templates.data.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onEdit={openDialog}
              onDelete={setToDelete}
            />
          ))}
        </ul>
      )}

      <TemplateDialog key={dialogKey} open={open} onOpenChange={setOpen} template={editing} />
      <DeleteTemplateDialog
        template={toDelete}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
      />
    </div>
  );
}
