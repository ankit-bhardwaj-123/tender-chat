import type { Tender } from "@/types";

export interface TenderDbRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toTender(row: TenderDbRow): Tender {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
