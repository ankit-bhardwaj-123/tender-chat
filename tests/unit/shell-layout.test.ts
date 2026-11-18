import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadShellLayout, saveShellLayout } from "@/lib/shell-layout";

const KEY = "tender-chat:shell-layout";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

describe("shell-layout", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is saved", () => {
    expect(loadShellLayout()).toBeNull();
  });

  it("returns the saved sizes when they were saved before", () => {
    saveShellLayout({ sidebar: 25, main: 75 });
    expect(loadShellLayout()).toEqual({ sidebar: 25, main: 75 });
  });

  it("returns null when the saved value is broken or out of range", () => {
    const broken = ["{", "[]", "null", "{}", '{"sidebar":"25"}', '{"sidebar":-1}', '{"a":101}'];
    for (const raw of broken) {
      localStorage.setItem(KEY, raw);
      expect(loadShellLayout()).toBeNull();
    }
  });

  it("doesn't throw when storage is blocked", () => {
    const blocked = memoryStorage();
    blocked.getItem = () => {
      throw new Error("SecurityError");
    };
    blocked.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    vi.stubGlobal("localStorage", blocked);
    expect(loadShellLayout()).toBeNull();
    expect(() => saveShellLayout({ sidebar: 25, main: 75 })).not.toThrow();
  });
});
