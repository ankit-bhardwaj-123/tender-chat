import type { Company, CompanyFileKind } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { sendWithFiles } from "@/lib/file-upload";

export const COMPANIES_KEY = ["companies"] as const;

const FAILED = "Something went wrong, please try again.";

export function companyFileUrl(companyId: string, kind: CompanyFileKind): string {
  return `/api/companies/${companyId}/files/${kind}`;
}

async function failure(res: Response): Promise<Error> {
  if (res.status >= 500) return new Error(FAILED);
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return new Error(body?.error?.message ?? FAILED);
}

async function readCompany(res: Response): Promise<Company> {
  if (!res.ok) throw await failure(res);
  return (await res.json()) as Company;
}

export async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch("/api/companies");
  if (!res.ok) throw new Error("Couldn't load your companies.");
  return (await res.json()) as Company[];
}

export function useCompanies() {
  return useQuery({ queryKey: COMPANIES_KEY, queryFn: fetchCompanies });
}

export async function saveCompanyName(companyId: string | null, name: string): Promise<Company> {
  const res = await fetch(companyId ? `/api/companies/${companyId}` : "/api/companies", {
    method: companyId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return readCompany(res);
}

export async function uploadCompanyFile(
  companyId: string,
  kind: CompanyFileKind,
  file: File,
): Promise<Company> {
  const res = await sendWithFiles(companyFileUrl(companyId, kind), "PUT", {}, [
    { name: "file", kind: "companyFile", file },
  ]);
  return readCompany(res);
}

export async function removeCompanyFile(
  companyId: string,
  kind: CompanyFileKind,
): Promise<Company> {
  const res = await fetch(companyFileUrl(companyId, kind), { method: "DELETE" });
  return readCompany(res);
}

export async function deleteCompany(companyId: string): Promise<void> {
  const res = await fetch(`/api/companies/${companyId}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res);
}
