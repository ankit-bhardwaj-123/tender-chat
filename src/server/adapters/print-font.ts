import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Font, FONT_SUBSETS, fontFileName } from "@/shared/fonts";

const cache = new Map<string, Promise<Map<string, string>>>();

async function loadSources(font: Font): Promise<Map<string, string>> {
  const folder = path.join(process.cwd(), "node_modules", "@fontsource", font.key, "files");
  const sources = new Map<string, string>();
  for (const weight of font.weights) {
    for (const subset of FONT_SUBSETS) {
      const fileName = fontFileName(font, subset.name, weight);
      const bytes = await readFile(path.join(folder, fileName));
      sources.set(fileName, `data:font/woff2;base64,${bytes.toString("base64")}`);
    }
  }
  return sources;
}

export async function printFontUrl(font: Font): Promise<(fileName: string) => string> {
  let sources = cache.get(font.key);
  if (!sources) {
    sources = loadSources(font).catch((error: unknown) => {
      cache.delete(font.key);
      throw error;
    });
    cache.set(font.key, sources);
  }
  const loaded = await sources;
  return (fileName) => loaded.get(fileName) ?? "";
}
