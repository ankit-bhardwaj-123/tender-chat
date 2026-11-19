"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { companyFileUrl, useCompanies } from "@/lib/companies";
import {
  EDITOR_SPLIT_KEY,
  NOT_FOUND,
  sameValues,
  splitStorage,
  useTemplateHtml,
  useTender,
} from "@/lib/editor";
import { useMediaQuery } from "@/lib/hooks";
import { useTemplates } from "@/lib/templates";
import { type EditorChange, EditorTopBar } from "./editor-top-bar";
import { PagePreview } from "./page-preview";
import { PlaceholderForm } from "./placeholder-form";

const DESKTOP_QUERY = "(min-width: 768px)";
const LEAVE = "Leave without saving?";

const CHANGING: Record<EditorChange, string> = {
  company: "Changing the company…",
  template: "Changing the template…",
  font: "Changing the font…",
};

interface DraftState {
  key: string;
  values: Record<string, string>;
}

function leavesPage(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement) || target.target === "_blank") return false;
  const url = new URL(target.href, window.location.href);
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

export function EditorPage() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const tender = useTender(tenderId);
  const companies = useCompanies();
  const templates = useTemplates();
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const split = useDefaultLayout({
    id: EDITOR_SPLIT_KEY,
    storage: splitStorage(),
  });
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [changing, setChanging] = useState<EditorChange | null>(null);

  const company = companies.data?.find((item) => item.id === tender.data?.companyId) ?? null;
  const template = templates.data?.find((item) => item.id === tender.data?.templateId) ?? null;
  const html = useTemplateHtml(template);

  const draftKey = tender.data ? `${tender.data.id}:${tender.data.templateId ?? ""}` : null;
  if (tender.data && draftKey !== null && draft?.key !== draftKey) {
    setDraft({ key: draftKey, values: tender.data.values });
  }
  const values = draft?.values ?? tender.data?.values ?? {};
  const dirty = tender.data ? !sameValues(values, tender.data.values) : false;

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      if (!leavesPage(event) || window.confirm(LEAVE)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

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

  const changeValue = (name: string, value: string) =>
    setDraft((current) => ({
      key: current?.key ?? draftKey ?? "",
      values: { ...(current?.values ?? values), [name]: value },
    }));

  const form = (
    <div className="h-full overflow-y-auto">
      <PlaceholderForm
        placeholders={template?.placeholders ?? null}
        values={values}
        onChange={changeValue}
      />
    </div>
  );
  const preview = (
    <PagePreview
      hasTemplate={template !== null}
      html={html.data}
      htmlError={html.isError}
      values={values}
      fontKey={company?.fontKey ?? null}
      letterheadUrl={
        company?.files.letterhead
          ? `${companyFileUrl(company.id, "letterhead")}?v=${encodeURIComponent(company.files.letterhead.uploadedAt)}`
          : null
      }
      sealUrl={
        company?.files.seal
          ? `${companyFileUrl(company.id, "seal")}?v=${encodeURIComponent(company.files.seal.uploadedAt)}`
          : null
      }
      onRetry={() => void html.refetch()}
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
        draft={values}
        dirty={dirty}
        onChanging={setChanging}
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
