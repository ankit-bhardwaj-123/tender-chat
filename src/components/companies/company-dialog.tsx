"use client";

import type { Company, CompanyFileKind } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  COMPANIES_KEY,
  companyFileUrl,
  removeCompanyFile,
  saveCompanyName,
  uploadCompanyFile,
} from "@/lib/companies";
import { FileField, type SavedFile } from "./file-field";

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
}

interface CompanyFormProps {
  company: Company | null;
  onSaved: () => void;
}

type PickedFiles = Partial<Record<CompanyFileKind, File>>;

const FILE_KINDS: readonly CompanyFileKind[] = ["letterhead", "seal"];
const FAILED = "Something went wrong, please try again.";

function CompanyForm({ company, onSaved }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(company?.name ?? "");
  const [saved, setSaved] = useState<Company | null>(company);
  const [picked, setPicked] = useState<PickedFiles>({});
  const [removed, setRemoved] = useState<ReadonlySet<CompanyFileKind>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const editing = company !== null;
  const busy = progress !== null;

  const fileProps = (kind: CompanyFileKind) => {
    const stored = saved?.files[kind] ?? null;
    const savedFile: SavedFile | null =
      saved && stored && !removed.has(kind)
        ? {
            fileName: stored.fileName,
            size: stored.size,
            href: `${companyFileUrl(saved.id, kind)}?v=${encodeURIComponent(stored.uploadedAt)}`,
          }
        : null;
    return {
      file: picked[kind] ?? null,
      saved: savedFile,
      disabled: busy,
      onChange: (file: File | null) =>
        setPicked((current) => {
          const next = { ...current };
          if (file) next[kind] = file;
          else delete next[kind];
          return next;
        }),
      onRemoveSaved: () => setRemoved((current) => new Set(current).add(kind)),
    };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const uploads = FILE_KINDS.flatMap((kind) => {
      const file = picked[kind];
      return file ? [{ kind, file }] : [];
    });
    const removals = [...removed].filter((kind) => !picked[kind] && saved?.files[kind]);
    try {
      setProgress("Saving…");
      let current = await saveCompanyName(saved?.id ?? null, name);
      setSaved(current);
      for (const kind of removals) {
        current = await removeCompanyFile(current.id, kind);
      }
      setRemoved(new Set());
      for (const [index, { kind, file }] of uploads.entries()) {
        setProgress(`Uploading ${index + 1} of ${uploads.length}…`);
        current = await uploadCompanyFile(current.id, kind, file);
        setSaved(current);
        setPicked((previous) => {
          const next = { ...previous };
          delete next[kind];
          return next;
        });
      }
      toast.success(editing ? "Company updated." : "Company added.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED);
    } finally {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogTitle className="text-lg font-semibold">
            {editing ? "Edit company" : "Add company"}
          </DialogTitle>
          <DialogDescription>
            The letterhead and seal go on the quotations made for this company.
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <IconButton type="button" label="Close" size="icon-sm" className="-mr-2">
            <X />
          </IconButton>
        </DialogClose>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <Field>
          <FieldLabel htmlFor="company-name">Company name</FieldLabel>
          <Input
            id="company-name"
            autoComplete="organization"
            placeholder="XYZ Pvt. Ltd."
            autoFocus
            required
            maxLength={200}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <FileField label="Letterhead" accept="pdf" {...fileProps("letterhead")} />
        <FileField label="Seal" accept="jpg" {...fileProps("seal")} />
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t bg-muted/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy || name.trim() === ""}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {progress ?? (editing ? "Save changes" : "Add company")}
        </Button>
      </footer>
    </form>
  );
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <CompanyForm company={company} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
