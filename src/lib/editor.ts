import type { Template, Tender, TenderCanvas, TenderImage } from "@/types";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sendWithFiles } from "@/lib/file-upload";
import { pageDocument } from "@/shared/page-document";

export interface TenderChanges {
  name?: string;
  companyId?: string | null;
  templateId?: string | null;
  values?: Record<string, string>;
  customHtml?: string | null;
  canvas?: TenderCanvas;
}

export interface TenderDraft {
  values: Record<string, string>;
  customHtml: string | null;
  canvas: TenderCanvas;
}

export type SaveStatus = "saved" | "saving" | "failed";

export interface Autosave {
  status: SaveStatus;
  flush: () => Promise<boolean>;
  retry: () => void;
}

export interface SplitStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export type PreviewZoom = "fit" | number;

export const NOT_FOUND = "not_found";
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const PX_PER_MM = A4_WIDTH_PX / 210;
export const ZOOM_STEPS: readonly number[] = [50, 60, 70, 75, 100, 125, 150, 200];
export const EDITOR_SPLIT_KEY = "tender-chat:editor-split";

const FAILED = "Something went wrong, please try again.";
export const PDF_FAILED = "PDF can't be made, please try again.";
const AUTOSAVE_MS = 800;
const KEEPALIVE_MAX_BYTES = 60000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: readonly string[] = ["jpg", "jpeg", "png"];
const NO_ANSWER = "no internet connection, or the server didn't answer";
const ZOOM_KEY = "tender-chat:preview-zoom";
const SIDE_PADDING_PX = 16;
const MIN_FIT_SCALE = 0.1;
const zoomListeners = new Set<() => void>();
const NO_STORAGE: SplitStorage = { getItem: () => null, setItem: () => {} };

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
  return pageDocument(
    html,
    values,
    fontKey,
    (fileName) => `${window.location.origin}/fonts/${fileName}`,
    "",
  );
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

function normalizedValues(values: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(values)) {
    map.set(key.normalize("NFC").replace(/\s+/g, " ").trim(), value.normalize("NFC"));
  }
  return map;
}

export function sameValues(a: Record<string, string>, b: Record<string, string>): boolean {
  const left = normalizedValues(a);
  const right = normalizedValues(b);
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    if ((left.get(key) ?? "") !== (right.get(key) ?? "")) return false;
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

export function draftChanges(draft: TenderDraft, saved: Tender): TenderChanges {
  const changes: TenderChanges = {};
  if (!sameValues(draft.values, saved.values)) changes.values = draft.values;
  if (draft.customHtml !== saved.customHtml) changes.customHtml = draft.customHtml;
  if (JSON.stringify(draft.canvas) !== JSON.stringify(saved.canvas)) changes.canvas = draft.canvas;
  return changes;
}

export function rebaseDraft(draft: TenderDraft, base: Tender, server: Tender): TenderDraft {
  return {
    values: sameValues(draft.values, base.values) ? server.values : draft.values,
    customHtml: draft.customHtml === base.customHtml ? server.customHtml : draft.customHtml,
    canvas:
      JSON.stringify(draft.canvas) === JSON.stringify(base.canvas) ? server.canvas : draft.canvas,
  };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function sendOnLeave(queryClient: QueryClient, tenderId: string, body: string) {
  queryClient.setQueryData<Tender>(tenderKey(tenderId), (tender) =>
    tender ? { ...tender, ...(JSON.parse(body) as TenderChanges) } : tender,
  );
  void fetch(`/api/tenders/${tenderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: byteLength(body) < KEEPALIVE_MAX_BYTES,
  })
    .then(async (res) => {
      if (res.ok) queryClient.setQueryData(tenderKey(tenderId), (await res.json()) as Tender);
    })
    .catch(() => {});
}

export function useAutosave(
  queryClient: QueryClient,
  tenderId: string,
  changes: TenderChanges,
): Autosave {
  const body = JSON.stringify(changes);
  const empty = body === "{}";
  const [failedBody, setFailedBody] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const send = (next: string) => {
    queue.current = queue.current.then(async () => {
      try {
        await saveTender(queryClient, tenderId, JSON.parse(next) as TenderChanges);
        if (pending.current === next) pending.current = null;
        setFailedBody(null);
      } catch {
        setFailedBody(next);
      }
    });
  };
  const sendRef = useRef(send);

  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    pending.current = empty ? null : body;
    if (empty) return;
    timer.current = setTimeout(() => sendRef.current(body), AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [body, empty, attempt]);

  useEffect(() => {
    const leave = () => {
      if (pending.current !== null) sendOnLeave(queryClient, tenderId, pending.current);
      pending.current = null;
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    const currentQueue = queue;
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
      void currentQueue.current.then(leave);
    };
  }, [queryClient, tenderId]);

  const flush = async () => {
    clearTimeout(timer.current);
    if (pending.current !== null) send(pending.current);
    await queue.current;
    return pending.current === null;
  };

  const status: SaveStatus = empty ? "saved" : failedBody === body ? "failed" : "saving";
  return {
    status,
    flush,
    retry: () => {
      setFailedBody(null);
      setAttempt((count) => count + 1);
    },
  };
}

export function tenderImageUrl(tenderId: string, imageId: string): string {
  return `/api/tenders/${tenderId}/images/${imageId}`;
}

export function imageProblem(file: File): string | null {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
  if (!IMAGE_EXTENSIONS.includes(extension)) return "it must be a JPG or PNG";
  if (file.size === 0) return "the file is empty";
  if (file.size > MAX_IMAGE_BYTES) return "it must be at most 5 MB";
  return null;
}

export async function uploadTenderImage(tenderId: string, file: File): Promise<TenderImage> {
  const problem = imageProblem(file);
  if (problem) throw new Error(problem);
  const res = await sendWithFiles(`/api/tenders/${tenderId}/images`, "POST", {}, [
    { name: "file", kind: "tenderImage", file },
  ]);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message = body?.error?.message;
    throw new Error(message ? message.replace(/\.$/, "") : NO_ANSWER);
  }
  return (await res.json()) as TenderImage;
}

export async function deleteTenderImage(tenderId: string, imageId: string): Promise<void> {
  await fetch(tenderImageUrl(tenderId, imageId), { method: "DELETE" }).catch(() => {});
}

function pdfFileName(res: Response): string {
  const header = res.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (!encoded) return "Quotation.pdf";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "Quotation.pdf";
  }
}

export async function requestTenderPdf(
  tenderId: string,
  sealTop: number | null,
): Promise<{ fileName: string; blob: Blob }> {
  const res = await fetch(`/api/tenders/${tenderId}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sealTop }),
  }).catch(() => {
    throw new Error(PDF_FAILED);
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(res.status >= 500 ? PDF_FAILED : (body?.error?.message ?? PDF_FAILED));
  }
  const blob = await res.blob().catch(() => {
    throw new Error(PDF_FAILED);
  });
  return { fileName: pdfFileName(res), blob };
}

export async function downloadTenderPdf(tenderId: string, sealTop: number | null): Promise<void> {
  const { fileName, blob } = await requestTenderPdf(tenderId, sealTop);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
