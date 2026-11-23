"use client";

import type { Company, SavedPdf, Template, Tender } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileDown, PencilLine, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  downloadTenderPdf,
  keptValues,
  type SaveStatus,
  saveTender,
  type TenderDraft,
} from "@/lib/editor";
import { editPdf, replacePdf, savePdf } from "@/lib/saved-pdfs";
import { nextPdfName } from "@/shared/pdf-name";
import { type SaveChoice, SavePdfDialog } from "./save-pdf-dialog";
import { SavedPdfsMenu } from "./saved-pdfs-menu";

interface EditorTopBarProps {
  tender: Tender;
  companies: readonly Company[];
  templates: readonly Template[];
  company: Company | null;
  template: Template | null;
  draft: TenderDraft;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
  onFlushSave: () => Promise<boolean>;
  onChanging: (change: EditorChange | null) => void;
  readSealTop: () => number | null;
  savedPdfs: readonly SavedPdf[] | undefined;
  editingPdf: SavedPdf | null;
}

export type EditorChange = "company" | "template" | "editing" | "done";

const FAILED = "Something went wrong, please try again.";
const NOT_SAVED = "Not saved, so the PDF wasn't made. Please try again.";
const PICK_FIRST = "Pick a company and a template first.";
const LINK = "text-sm font-medium text-primary underline-offset-4 hover:underline";

function failed(error: unknown) {
  toast.error(error instanceof Error ? error.message : FAILED);
}

export function EditorTopBar({
  tender,
  companies,
  templates,
  company,
  template,
  draft,
  saveStatus,
  onRetrySave,
  onFlushSave,
  onChanging,
  readSealTop,
  savedPdfs,
  editingPdf,
}: EditorTopBarProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<EditorChange | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [making, setMaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const editing = tender.editingPdfId !== null;

  const run = async (label: EditorChange, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await onFlushSave();
      onChanging(label);
      await action();
    } catch (error) {
      failed(error);
    } finally {
      setBusy(null);
      onChanging(null);
    }
  };

  const changeCompany = (companyId: string) =>
    void run("company", () => saveTender(queryClient, tender.id, { companyId }));

  const changeTemplate = (next: Template) =>
    void run("template", () =>
      saveTender(queryClient, tender.id, {
        templateId: next.id,
        values: keptValues(draft.values, next.placeholders),
        canvas: draft.canvas,
      }),
    );

  const editPdfNow = (pdf: SavedPdf) =>
    void run("editing", async () => {
      await editPdf(queryClient, tender.id, pdf.id);
      toast.success(`Editing “${pdf.name}”.`);
    });

  const stopEditing = () =>
    void run("done", () => saveTender(queryClient, tender.id, { editingPdfId: null }));

  const openSaveDialog = () => {
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const saveCurrentPdf = async (choice: SaveChoice, name: string) => {
    setSaving(true);
    try {
      if (!(await onFlushSave())) {
        toast.error(NOT_SAVED);
        return;
      }
      const sealTop = draft.canvas.seal.y === null ? readSealTop() : null;
      if (choice === "replace" && editingPdf) {
        const saved = await replacePdf(queryClient, tender.id, editingPdf.id, sealTop, name);
        toast.success(`Updated “${saved.name}”.`);
      } else {
        const saved = await savePdf(queryClient, tender.id, sealTop, name);
        toast.success(`Saved as “${saved.name}”.`);
      }
      setDialogOpen(false);
    } catch (error) {
      failed(error);
    } finally {
      setSaving(false);
    }
  };

  const generatePdf = async () => {
    setMaking(true);
    try {
      if (!(await onFlushSave())) {
        toast.error(NOT_SAVED);
        return;
      }
      await downloadTenderPdf(tender.id, draft.canvas.seal.y === null ? readSealTop() : null);
    } catch (error) {
      failed(error);
    } finally {
      setMaking(false);
    }
  };

  const canMakePdf = editing || (company !== null && template !== null);
  const baseName = editingPdf?.companyName ?? company?.name ?? "Quotation";
  const suggestedName = nextPdfName(
    baseName,
    (savedPdfs ?? []).map((pdf) => pdf.name),
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
      <Select value="quotation" disabled={busy !== null}>
        <SelectTrigger aria-label="Type" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="quotation">Quotation</SelectItem>
          <SelectItem value="notesheet" disabled>
            Notesheet (coming soon)
          </SelectItem>
        </SelectContent>
      </Select>

      {companies.length === 0 ? (
        <Link href="/settings/companies" className={LINK}>
          Add company
        </Link>
      ) : (
        <Select
          value={company?.id ?? ""}
          onValueChange={changeCompany}
          disabled={busy !== null || editing}
        >
          <SelectTrigger aria-label="Company" className="w-48">
            <SelectValue placeholder="Pick a company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {templates.length === 0 ? (
        <Link href="/settings/templates" className={LINK}>
          Add template
        </Link>
      ) : (
        <Select
          value={template?.id ?? ""}
          onValueChange={(templateId) => {
            const next = templates.find((item) => item.id === templateId);
            if (next && next.id !== template?.id) setPendingTemplate(next);
          }}
          disabled={busy !== null || editing}
        >
          <SelectTrigger aria-label="Template" className="w-48">
            <SelectValue placeholder="Pick a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <SavedPdfsMenu
        tenderId={tender.id}
        pdfs={savedPdfs}
        editingId={tender.editingPdfId}
        disabled={busy !== null || saving || making}
        onEdit={editPdfNow}
      />

      {editing && (
        <span className="flex max-w-72 items-center gap-1.5 rounded-full bg-info-soft py-0.5 pr-0.5 pl-2.5 text-xs text-info">
          <PencilLine className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate" title={editingPdf?.name}>
            Editing “{editingPdf?.name ?? "saved PDF"}”
          </span>
          <Button
            variant="outline"
            size="xs"
            className="h-6 rounded-full bg-card"
            disabled={busy !== null || saving}
            onClick={stopEditing}
          >
            Done
          </Button>
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span role="status" className="flex items-center gap-1.5 text-xs">
          {saveStatus === "failed" && (
            <>
              <CircleAlert className="size-3.5 text-destructive" aria-hidden />
              <span className="text-destructive">Not saved</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 text-xs"
                onClick={onRetrySave}
              >
                Retry
              </Button>
            </>
          )}
        </span>
        {!canMakePdf && (
          <span id="pdf-needs" className="text-xs text-muted-foreground">
            {PICK_FIRST}
          </span>
        )}
        <span>
          <Button
            variant="outline"
            aria-describedby={canMakePdf ? undefined : "pdf-needs"}
            disabled={!canMakePdf || making || saving || busy !== null}
            onClick={openSaveDialog}
          >
            {saving ? <Spinner aria-hidden /> : <Save aria-hidden />}
            {saving ? "Saving PDF…" : "Save"}
          </Button>
        </span>
        <span>
          <Button
            aria-describedby={canMakePdf ? undefined : "pdf-needs"}
            disabled={!canMakePdf || making || saving || busy !== null}
            onClick={() => void generatePdf()}
          >
            {making ? <Spinner aria-hidden /> : <FileDown aria-hidden />}
            {making ? "Making PDF…" : "Generate PDF"}
          </Button>
        </span>
      </div>

      <SavePdfDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingPdf ? { id: editingPdf.id, name: editingPdf.name } : null}
        suggestedName={suggestedName}
        busy={saving}
        onSave={(choice, name) => void saveCurrentPdf(choice, name)}
      />

      <AlertDialog
        open={pendingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change template?</AlertDialogTitle>
            <AlertDialogDescription>
              Values for blanks the new template doesn&apos;t have will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) changeTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
