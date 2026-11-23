"use client";

import type { Tender } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { companyFileUrl, useCompanies } from "@/lib/companies";
import {
  draftChanges,
  EDITOR_SPLIT_KEY,
  NOT_FOUND,
  rebaseDraft,
  splitStorage,
  type TenderDraft,
  useAutosave,
  useTemplateHtml,
  useTender,
} from "@/lib/editor";
import { useMediaQuery } from "@/lib/hooks";
import { partUrl, useSavedPdfs } from "@/lib/saved-pdfs";
import { useTemplates } from "@/lib/templates";
import { fontOf, fontStack } from "@/shared/fonts";
import { findPlaceholders } from "@/shared/placeholders";
import { type EditorChange, EditorTopBar } from "./editor-top-bar";
import { PagePreview } from "./page-preview";
import { PlaceholderForm } from "./placeholder-form";

const DESKTOP_QUERY = "(min-width: 768px)";

const CHANGING: Record<EditorChange, string> = {
  company: "Changing the company…",
  template: "Changing the template…",
  editing: "Opening the saved PDF for editing…",
  done: "Going back to normal editing…",
};

interface DraftState {
  key: string;
  base: Tender;
  draft: TenderDraft;
}

function draftOf(tender: Tender): TenderDraft {
  return { values: tender.values, customHtml: tender.customHtml, canvas: tender.canvas };
}

export function EditorPage() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const queryClient = useQueryClient();
  const tender = useTender(tenderId);
  const companies = useCompanies();
  const templates = useTemplates();
  const savedPdfs = useSavedPdfs(tenderId);
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const split = useDefaultLayout({
    id: EDITOR_SPLIT_KEY,
    storage: splitStorage(),
  });
  const [state, setState] = useState<DraftState | null>(null);
  const [changing, setChanging] = useState<EditorChange | null>(null);
  const sealTopRef = useRef<number | null>(null);
  const onSealTop = useCallback((mm: number | null) => {
    sealTopRef.current = mm;
  }, []);
  const readSealTop = useCallback(() => sealTopRef.current, []);

  const company = companies.data?.find((item) => item.id === tender.data?.companyId) ?? null;
  const template = templates.data?.find((item) => item.id === tender.data?.templateId) ?? null;
  const html = useTemplateHtml(template);

  const draftKey = tender.data
    ? `${tender.data.id}:${tender.data.templateId ?? ""}:${tender.data.editingPdfId ?? ""}`
    : null;
  if (tender.data && draftKey !== null && state?.key !== draftKey) {
    setState({ key: draftKey, base: tender.data, draft: draftOf(tender.data) });
  } else if (tender.data && state !== null && state.base.updatedAt !== tender.data.updatedAt) {
    setState({
      key: state.key,
      base: tender.data,
      draft: rebaseDraft(state.draft, state.base, tender.data),
    });
  }
  const draft = state?.draft ?? (tender.data ? draftOf(tender.data) : null);
  const changes = tender.data && draft && changing === null ? draftChanges(draft, tender.data) : {};
  const autosave = useAutosave(queryClient, tenderId, changes);

  if (tender.isPending || companies.isPending || templates.isPending) {
    return (
      <div role="status" aria-label="Loading…" className="flex flex-1 flex-col">
        <div className="flex gap-2 border-b px-4 py-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex flex-1 gap-6 p-6">
          <Skeleton className="h-64 w-1/3" />
          <Skeleton className="h-full flex-1" />
        </div>
      </div>
    );
  }

  if (tender.isError) {
    const missing = tender.error.message === NOT_FOUND;
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <h1 className="text-lg font-semibold">
          {missing ? "Tender not found" : "Couldn't load the tender."}
        </h1>
        {missing ? (
          <Link
            href="/"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to the start page
          </Link>
        ) : (
          <Button variant="outline" onClick={() => void tender.refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (companies.isError || templates.isError) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <h1 className="text-lg font-semibold">Couldn&apos;t load your companies or templates.</h1>
        <Button
          variant="outline"
          onClick={() => {
            void companies.refetch();
            void templates.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const updating = changing !== null || (template !== null && html.isFetching);

  const current = draft ?? draftOf(tender.data);
  const saved = tender.data;
  const update = (change: (draft: TenderDraft) => Partial<TenderDraft>) =>
    setState((previous) => {
      const base = previous?.draft ?? current;
      return {
        key: previous?.key ?? draftKey ?? "",
        base: previous?.base ?? saved,
        draft: { ...base, ...change(base) },
      };
    });
  const changeValues = (next: Record<string, string>) =>
    update((base) => ({ values: { ...base.values, ...next } }));

  const editingPdf = savedPdfs.data?.find((pdf) => pdf.id === tender.data.editingPdfId) ?? null;
  const editing = tender.data.editingPdfId !== null;
  const hasPage = template !== null || editing;
  const source = hasPage ? (current.customHtml ?? html.data) : undefined;
  const placeholders = hasPage
    ? current.customHtml !== null
      ? findPlaceholders(current.customHtml)
      : (template?.placeholders ?? null)
    : null;
  const fontKey = editing ? (editingPdf?.fontKey ?? null) : (company?.fontKey ?? null);
  const letterheadUrl = editing
    ? editingPdf?.hasLetterhead
      ? partUrl(tender.data.id, editingPdf, "letterhead")
      : null
    : company?.files.letterhead
      ? `${companyFileUrl(company.id, "letterhead")}?v=${encodeURIComponent(company.files.letterhead.uploadedAt)}`
      : null;
  const sealUrl = editing
    ? editingPdf?.hasSeal
      ? partUrl(tender.data.id, editingPdf, "seal")
      : null
    : company?.files.seal
      ? `${companyFileUrl(company.id, "seal")}?v=${encodeURIComponent(company.files.seal.uploadedAt)}`
      : null;

  const form = (
    <div className="h-full overflow-y-auto">
      <PlaceholderForm
        placeholders={placeholders}
        values={current.values}
        onChange={(name, value) => changeValues({ [name]: value })}
      />
    </div>
  );
  const preview = (
    <PagePreview
      tenderId={tender.data.id}
      hasTemplate={hasPage}
      canReset={!editing}
      source={source}
      edited={current.customHtml !== null}
      htmlError={html.isError}
      values={current.values}
      fontKey={fontKey}
      fontFamily={fontStack(fontOf(fontKey))}
      canvas={current.canvas}
      onValues={changeValues}
      onHtml={(customHtml) => update(() => ({ customHtml }))}
      onCanvas={(change) => update((base) => ({ canvas: change(base.canvas) }))}
      letterheadUrl={letterheadUrl}
      sealUrl={sealUrl}
      onRetry={() => void html.refetch()}
      onSealTop={onSealTop}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{tender.data.name}</h1>
      <EditorTopBar
        tender={tender.data}
        companies={companies.data}
        templates={templates.data}
        company={company}
        template={template}
        draft={current}
        saveStatus={autosave.status}
        onRetrySave={autosave.retry}
        onFlushSave={autosave.flush}
        onChanging={setChanging}
        readSealTop={readSealTop}
        savedPdfs={savedPdfs.data}
        editingPdf={editingPdf}
      />
      <div className="relative flex min-h-0 flex-1 flex-col" aria-busy={updating}>
        {isDesktop ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
            defaultLayout={split.defaultLayout}
            onLayoutChanged={split.onLayoutChanged}
          >
            <ResizablePanel id="form" defaultSize="35%" minSize="25%" maxSize="70%">
              {form}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              aria-label="Resize the form and the preview"
              className="w-1 bg-input transition-colors hover:bg-primary/50 focus-visible:bg-primary/50"
            />
            <ResizablePanel id="preview" minSize="30%">
              <div className="flex h-full flex-col">{preview}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-col">
            {form}
            <div className="flex h-[80dvh] flex-col border-t">{preview}</div>
          </div>
        )}
        {updating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2 rounded-lg border bg-popover px-4 py-2 text-sm shadow-sm">
              <Spinner className="text-primary" aria-hidden />
              <span role="status">{changing ? CHANGING[changing] : "Loading the template…"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
