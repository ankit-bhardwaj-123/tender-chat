import { describe, expect, it } from "vitest";
import {
  CanvasBody,
  defaultCanvas,
  keepOnSheet,
  MIN_ITEM_MM,
  newImage,
  newTextBox,
  PAGE_WIDTH_MM,
  readCanvas,
} from "@/shared/canvas";

const IMAGE_ID = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";

describe("canvas", () => {
  it("starts with no items and the seal at its auto spot", () => {
    expect(defaultCanvas()).toEqual({
      items: [],
      seal: { shown: true, x: null, y: null, width: 35 },
    });
    expect(CanvasBody.safeParse(defaultCanvas()).success).toBe(true);
  });

  it("makes an empty text box at the clicked spot", () => {
    expect(newTextBox("t", 30, 400)).toEqual({
      id: "t",
      kind: "text",
      x: 30,
      y: 400,
      width: 70,
      height: 10,
      text: "",
      imageId: null,
    });
  });

  it("makes an image item that points at the uploaded image", () => {
    const item = newImage("i", IMAGE_ID, 20, 20);
    expect(item).toMatchObject({ kind: "image", imageId: IMAGE_ID, x: 20, y: 20 });
    expect(CanvasBody.safeParse({ ...defaultCanvas(), items: [item] }).success).toBe(true);
  });

  it("keeps an item inside the page width and below the top", () => {
    expect(newTextBox("t", 200, -5)).toMatchObject({ x: PAGE_WIDTH_MM - 70, y: 0 });
    expect(keepOnSheet({ ...newTextBox("t", 0, 0), width: 1, height: 1 })).toMatchObject({
      width: MIN_ITEM_MM,
      height: MIN_ITEM_MM,
    });
    expect(keepOnSheet({ ...newTextBox("t", 0, 0), width: 500 })).toMatchObject({
      x: 0,
      width: PAGE_WIDTH_MM,
    });
  });

  it("lets items sit on page 2 and further down", () => {
    expect(newTextBox("t", 10, 650).y).toBe(650);
  });

  it("falls back to the default canvas when the stored one is broken", () => {
    expect(readCanvas(null)).toEqual(defaultCanvas());
    expect(readCanvas({ items: "x" })).toEqual(defaultCanvas());
  });
});
