import { eq, type SQL } from "drizzle-orm";
import { tender } from "./schema";

export function ownedBy(userId: string): SQL {
  return eq(tender.userId, userId);
}
