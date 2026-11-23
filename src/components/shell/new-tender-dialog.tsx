"use client";

import { Loader2 } from "lucide-react";
import type { CreatedTender } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useShell } from "./shell-context";

const NAME_MAX_LENGTH = 200;

function cleanName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

export interface ParentFolder {
  id: string;
  name: string;
}

interface NewTenderRequest {
  name: string;
  parentId?: string;
  subfolderName?: string;
}

interface NewTenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: ParentFolder | null;
}

export function NewTenderDialog({ open, onOpenChange, parent = null }: NewTenderDialogProps) {
  const router = useRouter();
  const { onNavigate } = useShell();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [withSubfolder, setWithSubfolder] = useState(false);
  const create = useMutation({
    mutationFn: async (body: NewTenderRequest) => {
      const res = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Something went wrong, please try again.");
      return (await res.json()) as CreatedTender;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenders"] }),
  });

  const changeOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setSubError(null);
      setWithSubfolder(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = cleanName(String(form.get("name") ?? ""));
    const subfolderName = cleanName(String(form.get("subfolderName") ?? ""));
    const nameMissing = name === "";
    const subMissing = !parent && withSubfolder && subfolderName === "";
    setError(
      nameMissing
        ? parent
          ? "Enter a name for the subfolder."
          : "Enter a name for the tender."
        : null,
    );
    setSubError(subMissing ? "Enter a name for the subfolder." : null);
    if (nameMissing || subMissing) return;
    const body: NewTenderRequest = { name };
    if (parent) body.parentId = parent.id;
    if (!parent && withSubfolder) body.subfolderName = subfolderName;
    create.mutate(body, {
      onSuccess: (created) => {
        changeOpen(false);
        router.push(`/t/${(created.subfolder ?? created.tender).id}`);
        onNavigate();
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });
  };

  const title = parent ? `New subfolder in “${parent.name}”` : "New tender";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogTitle className={parent ? "text-base font-semibold" : "sr-only"}>
            {title}
          </DialogTitle>
          <Field data-invalid={error !== null || undefined}>
            <FieldLabel htmlFor="new-tender-name">
              {parent ? "Subfolder name" : "Tender name"}
            </FieldLabel>
            <Input
              id="new-tender-name"
              name="name"
              autoFocus
              autoComplete="off"
              maxLength={NAME_MAX_LENGTH}
              placeholder={parent ? "Enter Subfolder Name" : "Enter Tender Name"}
              aria-invalid={error !== null || undefined}
              aria-describedby={error ? "new-tender-name-error" : undefined}
              onChange={() => setError(null)}
            />
            <FieldError id="new-tender-name-error">{error}</FieldError>
          </Field>
          {!parent && (
            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox
                checked={withSubfolder}
                onCheckedChange={(checked) => {
                  setWithSubfolder(checked === true);
                  setSubError(null);
                }}
              />
              Add a subfolder
            </label>
          )}
          {!parent && withSubfolder && (
            <Field data-invalid={subError !== null || undefined}>
              <FieldLabel htmlFor="new-subfolder-name">Subfolder name</FieldLabel>
              <Input
                id="new-subfolder-name"
                name="subfolderName"
                autoComplete="off"
                maxLength={NAME_MAX_LENGTH}
                placeholder="Enter Subfolder Name"
                aria-invalid={subError !== null || undefined}
                aria-describedby={subError ? "new-subfolder-name-error" : undefined}
                onChange={() => setSubError(null)}
              />
              <FieldError id="new-subfolder-name-error">{subError}</FieldError>
            </Field>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
