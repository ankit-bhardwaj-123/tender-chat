"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type SaveChoice = "replace" | "new";

export interface EditedPdf {
  id: string;
  name: string;
}

interface SavePdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditedPdf | null;
  suggestedName: string;
  busy: boolean;
  onSave: (choice: SaveChoice, name: string) => void;
}

const NAME_MAX_LENGTH = 200;

export function SavePdfDialog({
  open,
  onOpenChange,
  editing,
  suggestedName,
  busy,
  onSave,
}: SavePdfDialogProps) {
  const [choice, setChoice] = useState<SaveChoice>(editing ? "replace" : "new");
  const [name, setName] = useState(editing ? editing.name : suggestedName);

  const pick = (next: SaveChoice) => {
    setChoice(next);
    setName(next === "replace" && editing ? editing.name : suggestedName);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(editing ? choice : "new", name);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogTitle className="text-base font-semibold">Save PDF</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a name for the saved PDF.
          </DialogDescription>
          {editing && (
            <fieldset className="grid gap-2 text-sm">
              <legend className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Save as
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="save-choice"
                  checked={choice === "replace"}
                  onChange={() => pick("replace")}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 truncate">Replace “{editing.name}”</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="save-choice"
                  checked={choice === "new"}
                  onChange={() => pick("new")}
                  className="size-4 accent-primary"
                />
                Save as a new PDF
              </label>
            </fieldset>
          )}
          <Field>
            <FieldLabel htmlFor="save-pdf-name">Name</FieldLabel>
            <Input
              id="save-pdf-name"
              autoFocus
              autoComplete="off"
              maxLength={NAME_MAX_LENGTH}
              value={name}
              placeholder={suggestedName}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner aria-hidden />}
              {busy ? "Saving PDF…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
