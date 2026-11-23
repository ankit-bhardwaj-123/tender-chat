import type { Tender } from "@/types";
import { useQuery } from "@tanstack/react-query";

export const ALL_TENDERS_KEY = ["tenders", ""];

export async function fetchTenders(search: string): Promise<Tender[]> {
  const url = search ? `/api/tenders?search=${encodeURIComponent(search)}` : "/api/tenders";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load your tenders.");
  return (await res.json()) as Tender[];
}

export function useAllTenders(enabled = true) {
  return useQuery({ queryKey: ALL_TENDERS_KEY, queryFn: () => fetchTenders(""), enabled });
}
