import { TEMPLATE_TAG } from "@/shared/fill-template";
import { cleanPlaceholderName, PLACEHOLDER } from "@/shared/placeholders";

export interface EditingHandlers {
  onValues: (values: Record<string, string>) => void;
  onHtml: (html: string) => void;
  onEmptyClick: (x: number, y: number) => void;
  onPointerDown: () => void;
}

const FIELD = "[data-field]";

function elementOf(node: Node | null | undefined): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function fieldOf(node: Node | null | undefined): HTMLElement | null {
  return elementOf(node)?.closest<HTMLElement>(FIELD) ?? null;
}

function placeCaret(page: Document, element: HTMLElement, atEnd: boolean) {
  const selection = page.getSelection();
  if (!selection) return;
  const range = page.createRange();
  range.selectNodeContents(element);
  range.collapse(!atEnd);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function fieldText(element: HTMLElement): string {
  return element.innerText.replace(/ /g, " ").replace(/\n$/, "");
}

function showEmpty(element: HTMLElement) {
  element.textContent = element.dataset.field ?? "";
  element.dataset.empty = "";
  element.dataset.value = "";
}

function originalTag(page: Document, element: Element): Element | null {
  const holder = page.createElement("template");
  holder.innerHTML = element.getAttribute(TEMPLATE_TAG) ?? "";
  return holder.content.firstElementChild;
}

function restoreAttributes(page: Document, element: Element) {
  const original = originalTag(page, element);
  if (!original) return;
  for (const name of element.getAttributeNames()) element.removeAttribute(name);
  for (const name of original.getAttributeNames()) {
    element.setAttribute(name, original.getAttribute(name) ?? "");
  }
}

export function fillAttributes(page: Document, values: Record<string, string>) {
  page.querySelectorAll(`[${TEMPLATE_TAG}]`).forEach((element) => {
    const original = originalTag(page, element);
    if (!original) return;
    for (const name of original.getAttributeNames()) {
      const raw = original.getAttribute(name) ?? "";
      const filled = raw.replace(PLACEHOLDER, (match: string, inner: string) => {
        const key = cleanPlaceholderName(inner);
        return key === "" ? match : (values[key] ?? "");
      });
      if (element.getAttribute(name) !== filled) element.setAttribute(name, filled);
    }
  });
}

export function htmlFromPage(page: Document, source: string): string {
  const body = page.body.cloneNode(true) as HTMLElement;
  body.querySelectorAll(FIELD).forEach((element) => {
    element.replaceWith(page.createTextNode(`{{${element.getAttribute("data-field") ?? ""}}}`));
  });
  body.querySelectorAll(`[${TEMPLATE_TAG}]`).forEach((element) => restoreAttributes(page, element));
  return withBody(source, body.innerHTML);
}

export function withBody(source: string, inner: string): string {
  const open = /<body\b[^>]*>/i.exec(source);
  const close = source.search(/<\/body\s*>/i);
  if (open && close > open.index) {
    return source.slice(0, open.index + open[0].length) + inner + source.slice(close);
  }
  if (open) return source.slice(0, open.index + open[0].length) + inner;
  const head = /<\/head\s*>/i.exec(source);
  if (head) return source.slice(0, head.index + head[0].length) + inner;
  const styles = source.match(/<style\b[\s\S]*?<\/style\s*>/gi) ?? [];
  return styles.join("") + inner;
}

function lineHeightOf(page: Document): number {
  const style = page.defaultView?.getComputedStyle(page.body);
  const lineHeight = Number.parseFloat(style?.lineHeight ?? "");
  if (Number.isFinite(lineHeight)) return lineHeight;
  const fontSize = Number.parseFloat(style?.fontSize ?? "");
  return (Number.isFinite(fontSize) ? fontSize : 16) * 1.2;
}

function distanceTo(rect: DOMRect, x: number, y: number): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

export function isEmptySpot(page: Document, x: number, y: number): boolean {
  const reach = lineHeightOf(page);
  const range = page.createRange();
  const walker = page.createTreeWalker(page.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (distanceTo(rect, x, y) < reach) return false;
    }
  }
  for (const image of Array.from(page.body.querySelectorAll("img"))) {
    if (distanceTo(image.getBoundingClientRect(), x, y) < reach) return false;
  }
  return true;
}

export function textBottomOf(page: Document): number {
  const range = page.createRange();
  const walker = page.createTreeWalker(page.body, NodeFilter.SHOW_TEXT);
  let bottom = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    bottom = Math.max(bottom, range.getBoundingClientRect().bottom);
  }
  page.body.querySelectorAll("img").forEach((image) => {
    bottom = Math.max(bottom, image.getBoundingClientRect().bottom);
  });
  return bottom;
}

export function sealGapOf(page: Document, lines: number): number {
  return lines * lineHeightOf(page);
}

export function attachEditing(
  page: Document,
  source: () => string,
  handlers: () => EditingHandlers,
): void {
  let composing = false;

  const claimTyped = (field: HTMLElement) => {
    const name = field.dataset.field ?? "";
    const text = field.textContent ?? "";
    if (text === name) return;
    field.textContent = text.includes(name) ? text.replace(name, "") : text;
    delete field.dataset.empty;
    placeCaret(page, field, true);
  };

  const sync = () => {
    const changed: Record<string, string> = {};
    page.querySelectorAll<HTMLElement>(FIELD).forEach((element) => {
      if (element.dataset.empty !== undefined && !composing) claimTyped(element);
      if (element.dataset.empty !== undefined) return;
      const text = fieldText(element);
      if (text === element.dataset.value) return;
      element.dataset.value = text;
      changed[element.dataset.field ?? ""] = text;
    });
    if (Object.keys(changed).length > 0) handlers().onValues(changed);
    const html = htmlFromPage(page, source());
    if (html !== source()) handlers().onHtml(html);
  };

  const fillEmpty = (field: HTMLElement, text: string) => {
    delete field.dataset.empty;
    field.textContent = text;
    placeCaret(page, field, true);
    sync();
  };

  const beforeInput = (event: InputEvent) => {
    if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
      event.preventDefault();
      const text = event.dataTransfer?.getData("text/plain") ?? "";
      if (event.inputType !== "insertFromPaste" || text === "") return;
      const field = fieldOf(page.getSelection()?.anchorNode);
      if (field?.dataset.empty !== undefined) fillEmpty(field, text);
      else page.execCommand("insertText", false, text);
      return;
    }
    const target = event.getTargetRanges()[0];
    if (!target) return;
    const field = fieldOf(target.startContainer);
    if (!field || !field.contains(target.endContainer)) return;
    if (field.dataset.empty !== undefined) {
      event.preventDefault();
      if (event.inputType === "insertText" && event.data) fillEmpty(field, event.data);
      return;
    }
    if (event.inputType === "insertParagraph") {
      event.preventDefault();
      page.execCommand("insertLineBreak");
      return;
    }
    const range = page.createRange();
    range.setStart(target.startContainer, target.startOffset);
    range.setEnd(target.endContainer, target.endOffset);
    const emptiesField =
      event.inputType.startsWith("delete") &&
      range.toString().length >= (field.textContent ?? "").length;
    if (emptiesField) {
      event.preventDefault();
      showEmpty(field);
      placeCaret(page, field, false);
      handlers().onValues({ [field.dataset.field ?? ""]: "" });
    }
  };

  const onClick = (event: MouseEvent) => {
    const selection = page.getSelection();
    if (selection && !selection.isCollapsed) return;
    if (isEmptySpot(page, event.clientX, event.clientY)) {
      handlers().onEmptyClick(event.clientX, event.clientY);
    }
  };

  page.body.contentEditable = "true";
  page.body.spellcheck = false;
  page.addEventListener("beforeinput", beforeInput);
  page.addEventListener("input", sync);
  page.addEventListener("compositionstart", () => {
    composing = true;
    const field = fieldOf(page.getSelection()?.anchorNode);
    if (field) field.dataset.composing = "";
  });
  page.addEventListener("compositionend", () => {
    composing = false;
    page.querySelectorAll<HTMLElement>("[data-composing]").forEach((field) => {
      delete field.dataset.composing;
    });
    sync();
  });
  page.addEventListener("click", onClick);
  page.addEventListener("pointerdown", () => handlers().onPointerDown());
}
