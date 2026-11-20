export interface Font {
  key: string;
  label: string;
  family: string;
  weights: readonly number[];
}

interface FontSubset {
  name: string;
  unicodeRange: string;
}

export const FONTS: readonly Font[] = [
  { key: "poppins", label: "Poppins", family: "Poppins", weights: [400, 700] },
  {
    key: "noto-serif-devanagari",
    label: "Noto Serif Devanagari",
    family: "Noto Serif Devanagari",
    weights: [400, 700],
  },
  { key: "mukta", label: "Mukta", family: "Mukta", weights: [400, 700] },
  { key: "khand", label: "Khand", family: "Khand", weights: [400, 700] },
  { key: "eczar", label: "Eczar", family: "Eczar", weights: [400, 700] },
  {
    key: "tiro-devanagari-hindi",
    label: "Tiro Devanagari Hindi",
    family: "Tiro Devanagari Hindi",
    weights: [400],
  },
  { key: "yatra-one", label: "Yatra One", family: "Yatra One", weights: [400] },
  {
    key: "anek-devanagari",
    label: "Anek Devanagari",
    family: "Anek Devanagari",
    weights: [400, 700],
  },
  { key: "laila", label: "Laila", family: "Laila", weights: [400, 700] },
  { key: "gotu", label: "Gotu", family: "Gotu", weights: [400] },
];

export const FONT_SUBSETS: readonly FontSubset[] = [
  {
    name: "devanagari",
    unicodeRange:
      "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09",
  },
  {
    name: "latin",
    unicodeRange:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
];

export const DEFAULT_FONT_KEY = "poppins";

export const FONT_KEYS: readonly string[] = FONTS.map((font) => font.key);

export function isFontKey(value: unknown): value is string {
  return typeof value === "string" && FONT_KEYS.includes(value);
}

export function fontOf(key: string | null | undefined): Font {
  const found = FONTS.find((font) => font.key === key);
  if (found) return found;
  const fallback = FONTS.find((font) => font.key === DEFAULT_FONT_KEY);
  if (!fallback) throw new Error("Default font missing");
  return fallback;
}

export function fontStack(font: Font): string {
  return `"${font.family}", system-ui, sans-serif`;
}

export function fontFileName(font: Font, subset: string, weight: number): string {
  return `${font.key}-${subset}-${weight}-normal.woff2`;
}

export function fontFaceCss(urlFor: (fileName: string) => string, only?: Font): string {
  const fonts = only ? [only] : FONTS;
  return fonts
    .flatMap((font) =>
      font.weights.flatMap((weight) =>
        FONT_SUBSETS.map(
          (subset) =>
            `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${urlFor(fontFileName(font, subset.name, weight))}") format("woff2");unicode-range:${subset.unicodeRange};}`,
        ),
      ),
    )
    .join("\n");
}
