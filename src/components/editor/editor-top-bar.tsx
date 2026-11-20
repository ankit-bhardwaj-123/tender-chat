"use client";

import type { Company, Template, Tender } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileDown, Loader2 } from "lucide-react";
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
import { COMPANIES_KEY, saveCompany } from "@/lib/companies";
import {
  downloadTenderPdf,
  keptValues,
  type SaveStatus,
  saveTender,
  type TenderDraft,
} from "@/lib/editor";
import { FONTS, fontOf, fontStack } from "@/shared/fonts";

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
}

export type EditorChange = "company" | "template" | "font";

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
}: EditorTopBarProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<EditorChange | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [making, setMaking] = useState(false);

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

  const changeFont = (fontKey: string) => {
    if (!company) return;
    void run("font", async () => {
      const saved = await saveCompany(company.id, { name: company.name, fontKey });
      queryClient.setQueryData<Company[]>(COMPANIES_KEY, (list) =>
        list?.map((item) => (item.id === saved.id ? saved : item)),
      );
      void queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
    });
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

  const font = fontOf(company?.fontKey ?? null);
  const canMakePdf = company !== null && template !== null;

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
        <Select value={company?.id ?? ""} onValueChange={changeCompany} disabled={busy !== null}>
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
          disabled={busy !== null}
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

      <Select value={font.key} onValueChange={changeFont} disabled={busy !== null || !company}>
        <SelectTrigger
          aria-label="Font"
          className="w-48"
          style={{ fontFamily: fontStack(font) }}
          title={company ? undefined : "Add a company to choose its font."}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONTS.map((item) => (
            <SelectItem key={item.key} value={item.key} style={{ fontFamily: fontStack(item) }}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-3">
        <span role="status" className="flex items-center gap-1.5 text-xs">
          {busy !== null || saveStatus === "saving" ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Saving…</span>
            </>
          ) : saveStatus === "failed" ? (
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
          ) : (
            <span className="text-muted-foreground">Saved</span>
          )}
        </span>
        {!canMakePdf && (
          <span id="pdf-needs" className="text-xs text-muted-foreground">
            {PICK_FIRST}
          </span>
        )}
        <span>
          <Button
            aria-describedby={canMakePdf ? undefined : "pdf-needs"}
            disabled={!canMakePdf || making || busy !== null}
            onClick={() => void generatePdf()}
          >
            {making ? <Spinner aria-hidden /> : <FileDown aria-hidden />}
            {making ? "Making PDF…" : "Generate PDF"}
          </Button>
        </span>
      </div>

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
