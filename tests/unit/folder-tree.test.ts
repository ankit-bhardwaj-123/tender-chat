import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  descendantIds,
  firstLeafId,
  treeRows,
  withAncestors,
} from "@/shared/folder-tree";

interface Row {
  id: string;
  parentId: string | null;
}

const rows: Row[] = [
  { id: "a", parentId: null },
  { id: "a1", parentId: "a" },
  { id: "b", parentId: null },
  { id: "a1x", parentId: "a1" },
  { id: "a2", parentId: "a" },
];

function shape(list: Row[], open: string[]) {
  return treeRows(list, new Set(open)).map((row) => [row.item.id, row.depth, row.hasChildren]);
}

describe("treeRows", () => {
  it("puts each folder's children right under it, in list order, with their depth", () => {
    expect(shape(rows, ["a", "a1"])).toEqual([
      ["a", 0, true],
      ["a1", 1, true],
      ["a1x", 2, false],
      ["a2", 1, false],
      ["b", 0, false],
    ]);
  });

  it("hides the children of a closed folder", () => {
    expect(shape(rows, ["a1"])).toEqual([
      ["a", 0, true],
      ["b", 0, false],
    ]);
  });

  it("shows a child whose parent is missing as a top-level folder", () => {
    expect(shape([{ id: "x", parentId: "gone" }], [])).toEqual([["x", 0, false]]);
  });

  it("shows every row once and doesn't hang when the data has a loop", () => {
    const loop: Row[] = [
      { id: "p", parentId: "q" },
      { id: "q", parentId: "p" },
      { id: "self", parentId: "self" },
    ];
    const ids = treeRows(loop, new Set(["p", "q", "self"])).map((row) => row.item.id);
    expect(ids.sort()).toEqual(["p", "q", "self"]);
  });
});

describe("descendantIds", () => {
  it("returns every folder below, at any depth, but not the folder itself", () => {
    expect([...descendantIds(rows, "a")].sort()).toEqual(["a1", "a1x", "a2"]);
    expect(descendantIds(rows, "b").size).toBe(0);
  });

  it("stops on a loop", () => {
    const loop: Row[] = [
      { id: "p", parentId: "q" },
      { id: "q", parentId: "p" },
    ];
    expect([...descendantIds(loop, "p")]).toEqual(["q"]);
  });
});

describe("ancestorIds and withAncestors", () => {
  it("returns the folders above, up to the top", () => {
    expect([...ancestorIds(rows, "a1x")].sort()).toEqual(["a", "a1"]);
  });

  it("keeps the matches plus their parents, in the original order", () => {
    expect(withAncestors(rows, new Set(["a1x"])).map((row) => row.id)).toEqual(["a", "a1", "a1x"]);
  });
});

describe("subfolder order and firstLeafId", () => {
  const dated = [
    { id: "top", parentId: null, createdAt: "2026-11-23T10:00:00.000Z" },
    { id: "late", parentId: "top", createdAt: "2026-11-23T12:00:00.000Z" },
    { id: "early", parentId: "top", createdAt: "2026-11-23T11:00:00.000Z" },
    { id: "earlyKid", parentId: "early", createdAt: "2026-11-23T13:00:00.000Z" },
  ];

  it("lists subfolders oldest first", () => {
    const ids = treeRows(dated, new Set(["top"])).map((row) => row.item.id);
    expect(ids).toEqual(["top", "early", "late"]);
  });

  it("walks down to the first-made subfolder that has none of its own", () => {
    expect(firstLeafId(dated, "top")).toBe("earlyKid");
    expect(firstLeafId(dated, "late")).toBe("late");
  });

  it("stops on a loop", () => {
    const loop = [
      { id: "p", parentId: "q" },
      { id: "q", parentId: "p" },
    ];
    expect(firstLeafId(loop, "p")).toBe("q");
  });
});
