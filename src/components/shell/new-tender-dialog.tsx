"use client";

import { Loader2 } from "lucide-react";
import type { Tender } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

interface NewTenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTenderDialog({ open, onOpenChange }: NewTenderDialogProps) {
  const router = useRouter();
  const { onNavigate } = useShell();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Something went wrong, please try again.");
      return (await res.json()) as Tender;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenders"] }),
  });

  const changeOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = cleanName(String(new FormData(event.currentTarget).get("name") ?? ""));
    if (name === "") {
      setError("Enter a name for the tender.");
      return;
    }
    create.mutate(name, {
      onSuccess: (tender) => {
        changeOpen(false);
        router.push(`/t/${tender.id}`);
        onNavigate();
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogTitle className="sr-only">New tender</DialogTitle>
          <Field data-invalid={error !== null || undefined}>
            <FieldLabel htmlFor="new-tender-name">Tender name</FieldLabel>
            <Input
              id="new-tender-name"
              name="name"
              autoFocus
              autoComplete="off"
              maxLength={NAME_MAX_LENGTH}
              placeholder="Enter Tender Name"
              aria-invalid={error !== null || undefined}
              aria-describedby={error ? "new-tender-name-error" : undefined}
              onChange={() => setError(null)}
            />
            <FieldError id="new-tender-name-error">{error}</FieldError>
          </Field>
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
