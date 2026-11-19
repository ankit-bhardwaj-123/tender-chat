import type { Template, Tender } from "@/types";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { fillTemplate, fontOverrideCss } from "@/shared/fill-template";
import { fontFaceCss, fontOf, fontStack } from "@/shared/fonts";

export interface TenderChanges {
  name?: string;
  companyId?: string | null;
  templateId?: string | null;
  values?: Record<string, string>;
}

export interface SplitStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export type PreviewZoom = "fit" | number;

export const NOT_FOUND = "not_found";
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const ZOOM_STEPS: readonly number[] = [50, 60, 70, 75, 100, 125, 150, 200];
export const EDITOR_SPLIT_KEY = "tender-chat:editor-split";

const FAILED = "Something went wrong, please try again.";
const ZOOM_KEY = "tender-chat:preview-zoom";
const SIDE_PADDING_PX = 16;
const MIN_FIT_SCALE = 0.1;
const zoomListeners = new Set<() => void>();
const NO_STORAGE: SplitStorage = { getItem: () => null, setItem: () => {} };

const PREVIEW_CSS =
  "html{width:210mm;min-height:297mm;box-sizing:border-box;background:transparent!important;overflow:hidden}body{background:transparent!important}[data-empty]{background:#eeeeea;color:#565c66;border-radius:2px;padding:0 2px}";

export function tenderKey(tenderId: string): readonly string[] {
  return ["tender", tenderId];
}

export function useTender(tenderId: string) {
  return useQuery({
    queryKey: tenderKey(tenderId),
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}`);
      if (res.status === 404) throw new Error(NOT_FOUND);
      if (!res.ok) throw new Error("Couldn't load the tender.");
      return (await res.json()) as Tender;
    },
    retry: false,
  });
}

export async function saveTender(
  queryClient: QueryClient,
  tenderId: string,
  changes: TenderChanges,
): Promise<Tender> {
  const res = await fetch(`/api/tenders/${tenderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(res.status >= 500 ? FAILED : (body?.error?.message ?? FAILED));
  }
  const tender = (await res.json()) as Tender;
  queryClient.setQueryData(tenderKey(tenderId), tender);
  void queryClient.invalidateQueries({ queryKey: ["tenders"] });
  return tender;
}

export function useTemplateHtml(template: Template | null) {
  return useQuery({
    queryKey: ["template-html", template?.id ?? "", template?.updatedAt ?? ""],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${template?.id ?? ""}/file`);
      if (!res.ok) throw new Error("Couldn't load the template.");
      return res.text();
    },
    enabled: template !== null,
    retry: false,
    staleTime: Infinity,
  });
}

export function previewDocument(
  html: string,
  values: Record<string, string>,
  fontKey: string | null,
): string {
  const font = fontOf(fontKey);
  const faces = fontFaceCss((fileName) => `${window.location.origin}/fonts/${fileName}`);
  const filled = fillTemplate(html, values, {
    mark: true,
    fontCss: fontOverrideCss(fontStack(font), faces),
  });
  const style = `<style data-preview="">${PREVIEW_CSS}</style>`;
  return /<\/head\s*>/i.test(filled)
    ? filled.replace(/<\/head\s*>/i, `${style}</head>`)
    : style + filled;
}

export function keptValues(
  values: Record<string, string>,
  placeholders: readonly string[],
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of placeholders) {
    const value = values[name];
    if (value !== undefined) kept[name] = value;
  }
  return kept;
}

export function sameValues(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

export function splitStorage(): SplitStorage {
  if (typeof window === "undefined") return NO_STORAGE;
  try {
    return window.localStorage;
  } catch {
    return NO_STORAGE;
  }
}

export function fitWidthScale(boxWidth: number): number {
  if (boxWidth <= 0) return 1;
  return Math.max(MIN_FIT_SCALE, (boxWidth - 2 * SIDE_PADDING_PX) / A4_WIDTH_PX);
}

export function nextZoom(zoom: PreviewZoom, fitPercent: number, direction: "in" | "out"): number {
  const base = zoom === "fit" ? fitPercent : zoom;
  const first = ZOOM_STEPS[0] ?? 50;
  const last = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 200;
  if (direction === "in") return ZOOM_STEPS.find((step) => step > base + 0.5) ?? last;
  return [...ZOOM_STEPS].reverse().find((step) => step < base - 0.5) ?? first;
}

function readZoom(): PreviewZoom {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw === null || raw === "fit") return "fit";
    const value = Number(raw);
    return ZOOM_STEPS.includes(value) ? value : "fit";
  } catch {
    return "fit";
  }
}

function subscribeZoom(listener: () => void): () => void {
  zoomListeners.add(listener);
  return () => zoomListeners.delete(listener);
}

export function savePreviewZoom(zoom: PreviewZoom): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {}
  zoomListeners.forEach((listener) => listener());
}

export function usePreviewZoom(): PreviewZoom {
  return useSyncExternalStore(subscribeZoom, readZoom, () => "fit");
}
