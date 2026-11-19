"use client";

import type { Company, Template, Tender } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { COMPANIES_KEY, saveCompany } from "@/lib/companies";
import { keptValues, saveTender } from "@/lib/editor";
import { FONTS, fontOf, fontStack } from "@/shared/fonts";

interface EditorTopBarProps {
  tender: Tender;
  companies: readonly Company[];
  templates: readonly Template[];
  company: Company | null;
  template: Template | null;
  draft: Record<string, string>;
  dirty: boolean;
  onChanging: (change: EditorChange | null) => void;
}

export type EditorChange = "company" | "template" | "font";

const FAILED = "Something went wrong, please try again.";
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
  dirty,
  onChanging,
}: EditorTopBarProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<EditorChange | "save" | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);

  const run = async (label: EditorChange | "save", action: () => Promise<unknown>) => {
    setBusy(label);
    if (label !== "save") onChanging(label);
    try {
      await action();
      if (label === "save") toast.success("Saved.");
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
        values: keptValues(draft, next.placeholders),
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

  const font = fontOf(company?.fontKey ?? null);

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

      <div className="ml-auto flex items-center gap-2">
        {busy !== null && busy !== "save" && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving…" />
        )}
        <Button
          disabled={busy !== null || !dirty}
          onClick={() =>
            void run("save", () => saveTender(queryClient, tender.id, { values: draft }))
          }
        >
          {busy === "save" && <Loader2 className="animate-spin" aria-hidden />}
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
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
