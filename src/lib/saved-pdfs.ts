import type { SavedPdf, Tender } from "@/types";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { tenderKey } from "@/lib/editor";
import { SAVE_FAILED } from "@/shared/pdf-body";

const PDF_FAILED = "PDF can't be made, please try again.";
const EDIT_FAILED = "This PDF can't be opened for editing.";

export function savedPdfsKey(tenderId: string): string[] {
  return ["saved-pdfs", tenderId];
}

export function savedPdfUrl(tenderId: string, pdfId: string): string {
  return `/api/tenders/${tenderId}/saved-pdfs/${pdfId}`;
}

export function partUrl(tenderId: string, pdf: SavedPdf, kind: "letterhead" | "seal"): string {
  const version = encodeURIComponent(pdf.editedAt ?? pdf.createdAt);
  return `${savedPdfUrl(tenderId, pdf.id)}/parts/${kind}?v=${version}`;
}

export function useSavedPdfs(tenderId: string) {
  return useQuery({
    queryKey: savedPdfsKey(tenderId),
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}/saved-pdfs`);
      if (!res.ok) throw new Error("Couldn't load the saved PDFs.");
      return (await res.json()) as SavedPdf[];
    },
  });
}

async function errorMessage(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message;
}

async function sendPdf(url: string, method: string, body: object): Promise<SavedPdf> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(PDF_FAILED);
  });
  if (!res.ok) {
    const message = await errorMessage(res);
    if (res.status >= 500) throw new Error(message === SAVE_FAILED ? SAVE_FAILED : PDF_FAILED);
    throw new Error(message ?? PDF_FAILED);
  }
  return (await res.json()) as SavedPdf;
}

async function refresh(queryClient: QueryClient, tenderId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: savedPdfsKey(tenderId) }),
    queryClient.invalidateQueries({ queryKey: tenderKey(tenderId) }),
  ]);
}

export async function savePdf(
  queryClient: QueryClient,
  tenderId: string,
  sealTop: number | null,
  name: string,
): Promise<SavedPdf> {
  const saved = await sendPdf(`/api/tenders/${tenderId}/saved-pdfs`, "POST", { sealTop, name });
  await refresh(queryClient, tenderId);
  return saved;
}

export async function replacePdf(
  queryClient: QueryClient,
  tenderId: string,
  pdfId: string,
  sealTop: number | null,
  name: string,
): Promise<SavedPdf> {
  const saved = await sendPdf(savedPdfUrl(tenderId, pdfId), "PUT", { sealTop, name });
  await refresh(queryClient, tenderId);
  return saved;
}

export async function editPdf(
  queryClient: QueryClient,
  tenderId: string,
  pdfId: string,
): Promise<Tender> {
  const res = await fetch(`${savedPdfUrl(tenderId, pdfId)}/edit`, { method: "POST" }).catch(() => {
    throw new Error(EDIT_FAILED);
  });
  if (!res.ok) {
    const message = await errorMessage(res);
    throw new Error(res.status === 400 && message ? message : EDIT_FAILED);
  }
  const tender = (await res.json()) as Tender;
  queryClient.setQueryData(tenderKey(tenderId), tender);
  return tender;
}
