"use client";

import type { Template, TemplateLanguage } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { FileField, type SavedFile } from "@/components/companies/file-field";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTemplate,
  editTemplate,
  LANGUAGES,
  replaceTemplateFile,
  TEMPLATES_KEY,
  templateFileUrl,
} from "@/lib/templates";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

interface TemplateFormProps {
  template: Template | null;
  onSaved: () => void;
}

const FAILED = "Something went wrong, please try again.";

function TemplateForm({ template, onSaved }: TemplateFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [language, setLanguage] = useState<TemplateLanguage>(template?.language ?? "hi");
  const [saved, setSaved] = useState<Template | null>(template);
  const [picked, setPicked] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const editing = template !== null;
  const busy = progress !== null;
  const savedFile: SavedFile | null = saved
    ? { fileName: saved.fileName, size: saved.size, href: templateFileUrl(saved) }
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!saved) {
        if (!picked) return;
        setProgress("Uploading…");
        setSaved(await createTemplate({ name, language }, picked));
        setPicked(null);
      } else {
        setProgress("Saving…");
        let current = await editTemplate(saved.id, { name, language });
        setSaved(current);
        if (picked) {
          setProgress("Uploading…");
          current = await replaceTemplateFile(current.id, picked);
          setSaved(current);
          setPicked(null);
        }
      }
      toast.success(editing ? "Template updated." : "Template added.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED);
    } finally {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogTitle className="text-lg font-semibold">
            {editing ? "Edit template" : "Add template"}
          </DialogTitle>
          <DialogDescription>
            {"An HTML layout with {{placeholders}} where the values go."}
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
          <FieldLabel htmlFor="template-name">Template name</FieldLabel>
          <Input
            id="template-name"
            autoComplete="off"
            placeholder="पैदल मार्च एवं पौधारोपण"
            autoFocus
            required
            maxLength={200}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="template-language">Language</FieldLabel>
          <Select
            value={language}
            disabled={busy}
            onValueChange={(value) => setLanguage(value as TemplateLanguage)}
          >
            <SelectTrigger id="template-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <FileField
          label="HTML layout"
          accept="html"
          file={picked}
          saved={savedFile}
          disabled={busy}
          removable={false}
          onChange={setPicked}
          onRemoveSaved={() => {}}
        />
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t bg-muted/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy || name.trim() === "" || (!saved && !picked)}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {progress ?? (editing ? "Save changes" : "Add template")}
        </Button>
      </footer>
    </form>
  );
}

export function TemplateDialog({ open, onOpenChange, template }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <TemplateForm template={template} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
