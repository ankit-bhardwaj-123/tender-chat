export interface FolderNode {
  id: string;
  parentId: string | null;
  createdAt?: string | Date;
}

function madeAt(node: FolderNode): number {
  return node.createdAt === undefined ? 0 : new Date(node.createdAt).getTime();
}

export interface TreeRow<T extends FolderNode> {
  item: T;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

function childrenByParent<T extends FolderNode>(rows: T[]): Map<string | null, T[]> {
  const ids = new Set(rows.map((row) => row.id));
  const byParent = new Map<string | null, T[]>();
  for (const row of rows) {
    const parent = row.parentId !== null && ids.has(row.parentId) ? row.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(row);
    byParent.set(parent, list);
  }
  for (const [parent, list] of byParent) {
    if (parent !== null) list.sort((a, b) => madeAt(a) - madeAt(b));
  }
  return byParent;
}

export function firstLeafId<T extends FolderNode>(rows: T[], id: string): string {
  const byParent = childrenByParent(rows);
  const seen = new Set([id]);
  let current = id;
  for (;;) {
    const next = (byParent.get(current) ?? []).find((child) => !seen.has(child.id));
    if (!next) return current;
    seen.add(next.id);
    current = next.id;
  }
}

export function descendantIds<T extends FolderNode>(rows: T[], id: string): Set<string> {
  const byParent = childrenByParent(rows);
  const found = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of byParent.get(current) ?? []) {
      if (child.id === id || found.has(child.id)) continue;
      found.add(child.id);
      queue.push(child.id);
    }
  }
  return found;
}

export function ancestorIds<T extends FolderNode>(rows: T[], id: string): Set<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const found = new Set<string>();
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && current !== id && !found.has(current) && byId.has(current)) {
    found.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return found;
}

export function withAncestors<T extends FolderNode>(rows: T[], matchIds: Set<string>): T[] {
  const keep = new Set(matchIds);
  for (const id of matchIds) {
    for (const ancestor of ancestorIds(rows, id)) keep.add(ancestor);
  }
  return rows.filter((row) => keep.has(row.id));
}

export function treeRows<T extends FolderNode>(rows: T[], openIds: Set<string>): TreeRow<T>[] {
  const byParent = childrenByParent(rows);
  const result: TreeRow<T>[] = [];
  const seen = new Set<string>();
  const visitItem = (item: T, depth: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const children = byParent.get(item.id) ?? [];
    const hasChildren = children.some((child) => child.id !== item.id);
    const open = hasChildren && openIds.has(item.id);
    result.push({ item, depth, hasChildren, open });
    if (open) {
      for (const child of children) visitItem(child, depth + 1);
    } else {
      markHidden(item.id);
    }
  };
  const markHidden = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      markHidden(child.id);
    }
  };
  for (const item of byParent.get(null) ?? []) visitItem(item, 0);
  for (const item of rows) {
    if (!seen.has(item.id)) visitItem(item, 0);
  }
  return result;
}
