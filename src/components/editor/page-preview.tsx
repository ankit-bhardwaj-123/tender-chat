"use client";

import { CircleAlert, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  fitWidthScale,
  nextZoom,
  previewDocument,
  savePreviewZoom,
  usePreviewZoom,
  ZOOM_STEPS,
} from "@/lib/editor";
import { valueHtml } from "@/shared/fill-template";

const LetterheadPage = dynamic(() => import("./letterhead-page"), { ssr: false });

const MIN_ZOOM = ZOOM_STEPS[0] ?? 50;
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 200;
const PX_PER_MM = A4_WIDTH_PX / 210;
const SEAL_MARGIN_MM = 25;
const SEAL_GAP_LINES = 2;
const SEAL_WIDTH_MM = 35;
const SEAL_WIDTH_PX = Math.round(SEAL_WIDTH_MM * PX_PER_MM);

interface PagePreviewProps {
  hasTemplate: boolean;
  html: string | undefined;
  htmlError: boolean;
  values: Record<string, string>;
  fontKey: string | null;
  letterheadUrl: string | null;
  sealUrl: string | null;
  onRetry: () => void;
}

interface FrameState {
  source: string;
  html: string;
  version: number;
}

function patchFields(page: Document, values: Record<string, string>) {
  page.querySelectorAll<HTMLElement>("[data-field]").forEach((element) => {
    const name = element.dataset.field ?? "";
    const value = values[name] ?? "";
    if (element.dataset.value === value && element.dataset.patched !== undefined) return;
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
}

function lineHeightOf(page: Document): number {
  const style = page.defaultView?.getComputedStyle(page.body);
  const lineHeight = Number.parseFloat(style?.lineHeight ?? "");
  if (Number.isFinite(lineHeight)) return lineHeight;
  const fontSize = Number.parseFloat(style?.fontSize ?? "");
  return (Number.isFinite(fontSize) ? fontSize : 16) * 1.2;
}

function textBottomOf(page: Document): number {
  const range = page.createRange();
  const walker = page.createTreeWalker(page.body, NodeFilter.SHOW_TEXT);
  let bottom = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    bottom = Math.max(bottom, range.getBoundingClientRect().bottom);
  }
  page.body.querySelectorAll("img").forEach((image) => {
    bottom = Math.max(bottom, image.getBoundingClientRect().bottom);
  });
  return bottom;
}

export function PagePreview({
  hasTemplate,
  html,
  htmlError,
  values,
  fontKey,
  letterheadUrl,
  sealUrl,
  onRetry,
}: PagePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT_PX);
  const [sealTop, setSealTop] = useState<number | null>(null);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [letterheadFailed, setLetterheadFailed] = useState(false);
  const [letterheadTry, setLetterheadTry] = useState(0);
  const zoom = usePreviewZoom();
  const fit = fitWidthScale(boxWidth);
  const scale = zoom === "fit" ? fit : zoom / 100;
  const percent = Math.round(scale * 100);
  const zoomBy = (direction: "in" | "out") => savePreviewZoom(nextZoom(zoom, fit * 100, direction));

  const source = html === undefined ? null : `${fontKey ?? ""}\n${html}`;
  if (html === undefined && frame !== null) setFrame(null);
  if (html !== undefined && source !== null && frame?.source !== source) {
    setFrame({
      source,
      html: previewDocument(html, values, fontKey),
      version: (frame?.version ?? 0) + 1,
    });
  }

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxWidth(entry.contentRect.width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const refresh = () => {
    const page = frameRef.current?.contentDocument;
    if (!page?.body) return;
    patchFields(page, values);
    const top = Math.round(textBottomOf(page) + SEAL_GAP_LINES * lineHeightOf(page));
    const sealBottom = sealUrl ? top + SEAL_WIDTH_PX : 0;
    setSealTop(top);
    setContentHeight(Math.max(A4_HEIGHT_PX, page.documentElement.scrollHeight, sealBottom));
  };

  useEffect(refresh);

  const onFrameLoad = () => {
    refresh();
    void frameRef.current?.contentDocument?.fonts.ready.then(refresh);
  };

  const pageCount = Math.ceil(contentHeight / A4_HEIGHT_PX);
  const sheetHeight = pageCount * A4_HEIGHT_PX;
  const ready = frame !== null || !hasTemplate;

  return (
    <section aria-label="Live preview" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-sm font-semibold">Live preview</h2>
          {frame !== null && (
            <span className="text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          )}
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

      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-muted">
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
                    className="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/40"
                    style={{ top: (index + 1) * A4_HEIGHT_PX }}
                  />
                ))}
                {frame !== null && (
                  <iframe
                    key={frame.version}
                    ref={frameRef}
                    title="Quotation preview"
                    sandbox="allow-same-origin"
                    srcDoc={frame.html}
                    onLoad={onFrameLoad}
                    className="absolute top-0 left-0 border-0"
                    style={{ width: A4_WIDTH_PX, height: sheetHeight }}
                  />
                )}
                {sealUrl && frame !== null && sealTop !== null && (
                  <Image
                    src={sealUrl}
                    alt="Seal"
                    unoptimized
                    width={SEAL_WIDTH_PX}
                    height={SEAL_WIDTH_PX}
                    className="pointer-events-none absolute"
                    style={{
                      right: SEAL_MARGIN_MM * PX_PER_MM,
                      top: sealTop,
                      width: SEAL_WIDTH_PX,
                      height: "auto",
                    }}
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
    </section>
  );
}
