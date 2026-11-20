"use client";

import type { CanvasItem, TenderCanvas } from "@/types";
import { ImageOff, Move, Trash2 } from "lucide-react";
import Image from "next/image";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { deleteTenderImage, PX_PER_MM, tenderImageUrl } from "@/lib/editor";
import {
  keepOnSheet,
  MIN_ITEM_MM,
  PAGE_WIDTH_MM,
  sealLeft,
  TEXT_BOX_FONT_PT,
} from "@/shared/canvas";

export const SEAL_ID = "seal";

interface CanvasLayerProps {
  tenderId: string;
  canvas: TenderCanvas;
  scale: number;
  fontFamily: string;
  sealUrl: string | null;
  autoSealTop: number | null;
  selectedId: string | null;
  focusId: string | null;
  onSelect: (id: string | null) => void;
  onFocused: () => void;
  onChange: (change: CanvasUpdate) => void;
}

export type CanvasUpdate = (canvas: TenderCanvas) => TenderCanvas;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Drag {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  box: Box;
}

const HANDLE_PX = 22;

function mm(value: number): number {
  return value * PX_PER_MM;
}

export function CanvasLayer({
  tenderId,
  canvas,
  scale,
  fontFamily,
  sealUrl,
  autoSealTop,
  selectedId,
  focusId,
  onSelect,
  onFocused,
  onChange,
}: CanvasLayerProps) {
  const drag = useRef<Drag | null>(null);
  const [brokenIds, setBrokenIds] = useState<readonly string[]>([]);
  const handle = HANDLE_PX / scale;

  const sealBox: Box | null =
    sealUrl && canvas.seal.shown && (canvas.seal.y !== null || autoSealTop !== null)
      ? {
          x: sealLeft(canvas.seal),
          y: canvas.seal.y ?? (autoSealTop ?? 0) / PX_PER_MM,
          width: canvas.seal.width,
          height: canvas.seal.width,
        }
      : null;

  const changeItem = (id: string, change: (item: CanvasItem) => CanvasItem) =>
    onChange((latest) => ({
      ...latest,
      items: latest.items.map((current) => (current.id === id ? change(current) : current)),
    }));

  const remove = (id: string) => {
    if (id === SEAL_ID) {
      onChange((latest) => ({ ...latest, seal: { ...latest.seal, shown: false } }));
    } else {
      const item = canvas.items.find((current) => current.id === id);
      if (item?.imageId) void deleteTenderImage(tenderId, item.imageId);
      onChange((latest) => ({
        ...latest,
        items: latest.items.filter((current) => current.id !== id),
      }));
    }
    onSelect(null);
  };

  const moveTo = (id: string, box: Box) => {
    if (id === SEAL_ID) {
      const width = Math.min(PAGE_WIDTH_MM, Math.max(MIN_ITEM_MM, box.width));
      onChange((latest) => ({
        ...latest,
        seal: {
          ...latest.seal,
          x: Math.min(PAGE_WIDTH_MM - width, Math.max(0, box.x)),
          y: Math.max(0, box.y),
          width,
        },
      }));
      return;
    }
    changeItem(id, (item) => keepOnSheet({ ...item, ...box }));
  };

  const startDrag = (event: PointerEvent, id: string, mode: Drag["mode"], box: Box) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(id);
    drag.current = { id, mode, startX: event.clientX, startY: event.clientY, box };
  };

  const onDragMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / scale / PX_PER_MM;
    const dy = (event.clientY - current.startY) / scale / PX_PER_MM;
    const { box } = current;
    if (current.mode === "move") {
      moveTo(current.id, { ...box, x: box.x + dx, y: box.y + dy });
    } else {
      moveTo(current.id, { ...box, width: box.width + dx, height: box.height + dy });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKey = (event: KeyboardEvent, id: string) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (event.target instanceof HTMLElement && event.target.dataset.editable !== undefined) return;
    event.preventDefault();
    remove(id);
  };

  const tools = (id: string, box: Box, resizable: boolean) =>
    selectedId === id && (
      <>
        <button
          type="button"
          aria-label="Move"
          title="Drag to move"
          className="absolute flex cursor-move items-center justify-center rounded-sm bg-primary text-primary-foreground"
          style={{ width: handle, height: handle, left: -handle, top: -handle }}
          onPointerDown={(event) => startDrag(event, id, "move", box)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
        >
          <Move style={{ width: handle * 0.6, height: handle * 0.6 }} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Delete"
          title="Delete"
          className="absolute flex items-center justify-center rounded-sm bg-destructive text-white"
          style={{ width: handle, height: handle, right: -handle, top: -handle }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => remove(id)}
        >
          <Trash2 style={{ width: handle * 0.6, height: handle * 0.6 }} aria-hidden />
        </button>
        {resizable && (
          <span
            aria-hidden
            className="absolute cursor-nwse-resize rounded-sm border-2 border-primary bg-white"
            style={{
              width: handle * 0.7,
              height: handle * 0.7,
              right: -handle * 0.35,
              bottom: -handle * 0.35,
            }}
            onPointerDown={(event) => startDrag(event, id, "resize", box)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          />
        )}
      </>
    );

  const frame = (id: string) =>
    selectedId === id
      ? "outline-2 outline-primary"
      : "outline-1 outline-transparent hover:outline-primary/40";

  return (
    <div className="pointer-events-none absolute inset-0">
      {canvas.items.map((item) => {
        const box: Box = { x: item.x, y: item.y, width: item.width, height: item.height };
        const place = {
          left: mm(item.x),
          top: mm(item.y),
          width: mm(item.width),
        };
        if (item.kind === "text") {
          return (
            <div
              key={item.id}
              className={`pointer-events-auto absolute outline-offset-2 ${frame(item.id)}`}
              style={{ ...place, minHeight: mm(item.height) }}
              onKeyDown={(event) => onKey(event, item.id)}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) startDrag(event, item.id, "move", box);
              }}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <div
                data-editable=""
                role="textbox"
                aria-label="Text box"
                aria-multiline
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                lang="hi"
                className="min-h-full whitespace-pre-wrap break-words text-black outline-none"
                style={{ fontFamily, fontSize: `${TEXT_BOX_FONT_PT}pt`, lineHeight: 1.3 }}
                ref={(node) => {
                  if (!node) return;
                  if (node.dataset.ready === undefined) {
                    node.textContent = item.text;
                    node.dataset.ready = "";
                  }
                  if (focusId === item.id) {
                    node.focus();
                    onFocused();
                  }
                }}
                onFocus={() => onSelect(item.id)}
                onInput={(event) => {
                  const text = event.currentTarget.innerText.replace(/\n$/, "");
                  changeItem(item.id, (latest) => ({ ...latest, text }));
                }}
                onBlur={(event) => {
                  if (event.currentTarget.innerText.trim() === "") remove(item.id);
                }}
              />
              {tools(item.id, box, false)}
            </div>
          );
        }
        const broken = item.imageId === null || brokenIds.includes(item.id);
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label="Image"
            className={`pointer-events-auto absolute cursor-move outline-offset-2 select-none ${frame(item.id)}`}
            style={{ ...place, height: mm(item.height) }}
            onKeyDown={(event) => onKey(event, item.id)}
            onPointerDown={(event) => {
              event.currentTarget.focus();
              startDrag(event, item.id, "move", box);
            }}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          >
            {broken ? (
              <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted text-center text-sm text-muted-foreground">
                <ImageOff className="size-5" aria-hidden />
                Image not found
              </div>
            ) : (
              <Image
                src={tenderImageUrl(tenderId, item.imageId ?? "")}
                alt=""
                unoptimized
                fill
                draggable={false}
                className="object-contain"
                onError={() => setBrokenIds((ids) => [...ids, item.id])}
              />
            )}
            {tools(item.id, box, true)}
          </div>
        );
      })}
      {sealBox && sealUrl && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Seal"
          className={`pointer-events-auto absolute cursor-move outline-offset-2 select-none ${frame(SEAL_ID)}`}
          style={{ left: mm(sealBox.x), top: mm(sealBox.y), width: mm(sealBox.width) }}
          onKeyDown={(event) => onKey(event, SEAL_ID)}
          onPointerDown={(event) => {
            event.currentTarget.focus();
            startDrag(event, SEAL_ID, "move", sealBox);
          }}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
        >
          <Image
            src={sealUrl}
            alt="Seal"
            unoptimized
            width={Math.round(mm(sealBox.width))}
            height={Math.round(mm(sealBox.width))}
            draggable={false}
            className="block h-auto w-full"
          />
          {tools(SEAL_ID, sealBox, true)}
        </div>
      )}
    </div>
  );
}
