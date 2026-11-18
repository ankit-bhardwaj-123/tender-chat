import type { Layout } from "react-resizable-panels";

const KEY = "tender-chat:shell-layout";

export function loadShellLayout(): Layout | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    const valid =
      entries.length > 0 &&
      entries.every(([, size]) => typeof size === "number" && size >= 0 && size <= 100);
    return valid ? (Object.fromEntries(entries) as Layout) : null;
  } catch {
    return null;
  }
}

export function saveShellLayout(layout: Layout): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {}
}
