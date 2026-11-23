"use client";

import type { TenderCanvas } from "@/types";
import {
  CircleAlert,
  ImagePlus,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Stamp,
  Type,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { IconButton } from "@/components/ui/icon-button";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  fitWidthScale,
  nextZoom,
  previewDocument,
  PX_PER_MM,
  savePreviewZoom,
  uploadTenderImage,
  usePreviewZoom,
  ZOOM_STEPS,
} from "@/lib/editor";
import {
  attachEditing,
  type EditingHandlers,
  fillAttributes,
  sealGapOf,
  textBottomOf,
} from "@/lib/page-editing";
import { newImage, newTextBox } from "@/shared/canvas";
import { valueHtml } from "@/shared/fill-template";
import { CanvasLayer, type CanvasUpdate } from "./canvas-layer";

const LetterheadPage = dynamic(() => import("./letterhead-page"), { ssr: false });

const MIN_ZOOM = ZOOM_STEPS[0] ?? 50;
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 200;
const SEAL_GAP_LINES = 2;
const SHEET_PADDING_PX = 16;
const NEW_ITEM_OFFSET_MM = 20;
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

interface PagePreviewProps {
  tenderId: string;
  hasTemplate: boolean;
  canReset: boolean;
  source: string | undefined;
  edited: boolean;
  htmlError: boolean;
  values: Record<string, string>;
  fontKey: string | null;
  fontFamily: string;
  letterheadUrl: string | null;
  sealUrl: string | null;
  canvas: TenderCanvas;
  onValues: (values: Record<string, string>) => void;
  onHtml: (html: string | null) => void;
  onCanvas: (change: CanvasUpdate) => void;
  onRetry: () => void;
  onSealTop: (mm: number | null) => void;
}

interface FrameState {
  font: string;
  source: string;
  html: string;
  version: number;
}

interface Measure {
  height: number;
  sealTop: number;
}

interface Latest {
  source: string;
  handlers: EditingHandlers;
}

function uploadReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/^Image must/, "it must").replace(/^The image/, "the image");
}

function patchFields(page: Document, values: Record<string, string>) {
  page.querySelectorAll<HTMLElement>("[data-field]").forEach((element) => {
    const name = element.dataset.field ?? "";
    const value = values[name] ?? "";
    if (element.dataset.value === value && element.dataset.patched !== undefined) return;
    if (element.dataset.composing !== undefined) return;
    element.dataset.patched = "";
    element.dataset.value = value;
    if (value === "") {
      element.textContent = name;
      element.dataset.empty = "";
    } else {
      element.innerHTML = valueHtml(value);
      delete element.dataset.empty;
    }
  });
  fillAttributes(page, values);
}

export function PagePreview({
  tenderId,
  hasTemplate,
  canReset,
  source,
  edited,
  htmlError,
  values,
  fontKey,
  fontFamily,
  letterheadUrl,
  sealUrl,
  canvas,
  onValues,
  onHtml,
  onCanvas,
  onRetry,
  onSealTop,
}: PagePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const latest = useRef<Latest | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [letterheadFailed, setLetterheadFailed] = useState(false);
  const [letterheadTry, setLetterheadTry] = useState(0);
  const zoom = usePreviewZoom();
  const fit = fitWidthScale(boxWidth);
  const scale = zoom === "fit" ? fit : zoom / 100;
  const percent = Math.round(scale * 100);
  const zoomBy = (direction: "in" | "out") => savePreviewZoom(nextZoom(zoom, fit * 100, direction));
  const font = fontKey ?? "";

  if (source === undefined && frame !== null) setFrame(null);
  if (source !== undefined && (frame?.font !== font || frame.source !== source)) {
    if (frame !== null && frame.font === font && source === typed) {
      setFrame({ ...frame, source });
    } else {
      setFrame({
        font,
        source,
        html: previewDocument(source, values, fontKey),
        version: (frame?.version ?? 0) + 1,
      });
    }
  }

  const addTextAt = (x: number, y: number) => {
    const item = newTextBox(crypto.randomUUID(), x, y);
    onCanvas((latest) => ({ ...latest, items: [...latest.items, item] }));
    setSelectedId(item.id);
    setFocusId(item.id);
  };

  const handlers: EditingHandlers = {
    onValues,
    onHtml: (html) => {
      setTyped(html);
      onHtml(html);
    },
    onEmptyClick: (x, y) => addTextAt(x / PX_PER_MM, y / PX_PER_MM),
    onPointerDown: () => setSelectedId(null),
  };

  useEffect(() => {
    latest.current = { source: frame?.source ?? "", handlers };
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry) setBoxWidth(entry.contentRect.width);
    });
    resize.observe(box);
    return () => {
      resize.disconnect();
      observer.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const page = frameRef.current?.contentDocument;
    if (page?.body) patchFields(page, values);
  });

  const measurePage = () => {
    const page = frameRef.current?.contentDocument;
    if (!page?.body) return;
    setMeasure({
      height: page.documentElement.offsetHeight,
      sealTop: Math.round(textBottomOf(page) + sealGapOf(page, SEAL_GAP_LINES)),
    });
  };

  const onFrameLoad = () => {
    const page = frameRef.current?.contentDocument;
    if (!page?.body) return;
    patchFields(page, values);
    attachEditing(
      page,
      () => latest.current?.source ?? "",
      () => latest.current?.handlers ?? handlers,
    );
    observer.current?.disconnect();
    observer.current = new ResizeObserver(measurePage);
    observer.current.observe(page.body);
    measurePage();
    void page.fonts.ready.then(measurePage);
  };

  const visibleTopMm = () => {
    const top = Math.max(0, (boxRef.current?.scrollTop ?? 0) - SHEET_PADDING_PX);
    return top / scale / PX_PER_MM + NEW_ITEM_OFFSET_MM;
  };

  const addImage = async (file: File) => {
    setUploading(true);
    try {
      const image = await uploadTenderImage(tenderId, file);
      const item = newImage(crypto.randomUUID(), image.id, NEW_ITEM_OFFSET_MM, visibleTopMm());
      onCanvas((latest) => ({ ...latest, items: [...latest.items, item] }));
      setSelectedId(item.id);
    } catch (error) {
      toast.error(`Image can't upload: ${uploadReason(error)}.`);
    } finally {
      setUploading(false);
    }
  };

  const sealTop = sealUrl ? (measure?.sealTop ?? null) : null;

  useEffect(() => {
    onSealTop(sealTop === null ? null : sealTop / PX_PER_MM);
  }, [onSealTop, sealTop]);
  const sealBottom =
    sealUrl && canvas.seal.shown
      ? canvas.seal.y !== null
        ? (canvas.seal.y + canvas.seal.width) * PX_PER_MM
        : (sealTop ?? 0) + canvas.seal.width * PX_PER_MM
      : 0;
  const itemsBottom = Math.max(
    0,
    ...canvas.items.map((item) => (item.y + item.height) * PX_PER_MM),
  );
  const contentHeight = Math.max(A4_HEIGHT_PX, measure?.height ?? 0, sealBottom, itemsBottom);
  const pageCount = Math.ceil(contentHeight / A4_HEIGHT_PX);
  const sheetHeight = pageCount * A4_HEIGHT_PX;
  const ready = frame !== null || !hasTemplate;
  const canAddSeal = sealUrl !== null && !canvas.seal.shown;

  return (
    <section aria-label="Live preview" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-sm font-semibold">Live preview</h2>
          {frame !== null && (
            <span className="text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          )}
        </div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Add to the page"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!ready}
            onClick={() => addTextAt(NEW_ITEM_OFFSET_MM, visibleTopMm())}
          >
            <Type aria-hidden />
            Add text
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!ready || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ImagePlus aria-hidden />
            )}
            {uploading ? "Uploading…" : "Add image"}
          </Button>
          {canAddSeal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onCanvas((latest) => ({
                  ...latest,
                  seal: { ...latest.seal, shown: true, x: null, y: null },
                }))
              }
            >
              <Stamp aria-hidden />
              Add seal
            </Button>
          )}
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              disabled={!edited}
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw aria-hidden />
              Reset template text
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void addImage(file);
            }}
          />
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <IconButton
            label="Zoom out"
            size="icon-sm"
            disabled={!ready || percent <= MIN_ZOOM}
            onClick={() => zoomBy("out")}
          >
            <Minus />
          </IconButton>
          <span aria-live="polite" className="w-11 text-center text-xs tabular-nums">
            {percent}%
          </span>
          <IconButton
            label="Zoom in"
            size="icon-sm"
            disabled={!ready || percent >= MAX_ZOOM}
            onClick={() => zoomBy("in")}
          >
            <Plus />
          </IconButton>
          <IconButton
            label="Fit width"
            size="icon-sm"
            aria-pressed={zoom === "fit"}
            disabled={!ready}
            onClick={() => savePreviewZoom("fit")}
          >
            <Maximize2 />
          </IconButton>
        </div>
      </header>

      {letterheadFailed && (
        <p role="alert" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm">
          <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="flex-1">Couldn&apos;t load the letterhead.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLetterheadFailed(false);
              setLetterheadTry((count) => count + 1);
            }}
          >
            Retry
          </Button>
        </p>
      )}

      <div
        ref={boxRef}
        className="min-h-0 flex-1 overflow-auto bg-muted"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelectedId(null);
        }}
      >
        {boxWidth > 0 && (
          <div className="w-max min-w-full px-4 py-4">
            <div
              className="relative mx-auto bg-white shadow-sm"
              style={{ width: A4_WIDTH_PX * scale, height: sheetHeight * scale }}
            >
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ width: A4_WIDTH_PX, height: sheetHeight, transform: `scale(${scale})` }}
              >
                {letterheadUrl && !letterheadFailed && (
                  <div aria-hidden className="pointer-events-none absolute top-0 left-0">
                    <LetterheadPage
                      key={`${letterheadUrl}#${letterheadTry}`}
                      url={letterheadUrl}
                      width={A4_WIDTH_PX}
                      onError={() => setLetterheadFailed(true)}
                    />
                  </div>
                )}
                {Array.from({ length: pageCount - 1 }, (_, index) => (
                  <div
                    key={index}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/40"
                    style={{ top: (index + 1) * A4_HEIGHT_PX }}
                  />
                ))}
                {frame !== null && (
                  <iframe
                    key={frame.version}
                    ref={frameRef}
                    title="Quotation page"
                    sandbox="allow-same-origin"
                    srcDoc={frame.html}
                    onLoad={onFrameLoad}
                    className="absolute top-0 left-0 border-0"
                    style={{ width: A4_WIDTH_PX, height: sheetHeight }}
                  />
                )}
                {ready && (
                  <CanvasLayer
                    tenderId={tenderId}
                    canvas={canvas}
                    scale={scale}
                    fontFamily={fontFamily}
                    sealUrl={sealUrl}
                    autoSealTop={sealTop}
                    selectedId={selectedId}
                    focusId={focusId}
                    onSelect={setSelectedId}
                    onFocused={() => setFocusId(null)}
                    onChange={onCanvas}
                  />
                )}
                {!hasTemplate && (
                  <p className="absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
                    No template yet.{" "}
                    <Link
                      href="/settings/templates"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Add template
                    </Link>
                  </p>
                )}
                {hasTemplate && htmlError && (
                  <div
                    role="alert"
                    className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-3 text-sm"
                  >
                    <p>Couldn&apos;t load the template.</p>
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  </div>
                )}
                {hasTemplate && !htmlError && frame === null && (
                  <p
                    role="status"
                    className="absolute inset-x-0 top-1/3 flex items-center justify-center gap-2 text-sm text-muted-foreground"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading the template…
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset template text?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to the template text will be undone. Values, added text, images and the
              seal stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTyped(null);
                onHtml(null);
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
