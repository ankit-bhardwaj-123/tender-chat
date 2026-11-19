import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const publicDir = path.resolve("public");

const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  await cp(path.join(pdfjsRoot, folder), path.join(publicDir, "pdfjs", folder), {
    recursive: true,
  });
}

await mkdir(path.join(publicDir, "tessdata"), { recursive: true });
for (const code of ["hin", "eng"]) {
  const packageRoot = path.dirname(require.resolve(`@tesseract.js-data/${code}/package.json`));
  const fileName = `${code}.traineddata.gz`;
  await cp(
    path.join(packageRoot, "4.0.0_best_int", fileName),
    path.join(publicDir, "tessdata", fileName),
  );
}

const tesseractRoot = path.dirname(require.resolve("tesseract.js/package.json"));
const coreRoot = path.dirname(
  createRequire(path.join(tesseractRoot, "package.json")).resolve("tesseract.js-core/package.json"),
);
await mkdir(path.join(publicDir, "tesseract"), { recursive: true });
await cp(
  path.join(tesseractRoot, "dist", "worker.min.js"),
  path.join(publicDir, "tesseract", "worker.min.js"),
);
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  const fileName = `tesseract-core-${variant}.wasm.js`;
  await cp(path.join(coreRoot, fileName), path.join(publicDir, "tesseract", fileName));
}

const fontRoot = path.dirname(require.resolve("@fontsource/noto-sans-devanagari/package.json"));
await mkdir(path.join(publicDir, "fonts"), { recursive: true });
for (const script of ["devanagari", "latin"]) {
  for (const weight of [400, 700]) {
    const fileName = `noto-sans-devanagari-${script}-${weight}-normal.woff2`;
    await cp(path.join(fontRoot, "files", fileName), path.join(publicDir, "fonts", fileName));
  }
}

const COMPANY_FONTS = [
  { id: "poppins", weights: [400, 700] },
  { id: "noto-serif-devanagari", weights: [400, 700] },
  { id: "mukta", weights: [400, 700] },
  { id: "khand", weights: [400, 700] },
  { id: "eczar", weights: [400, 700] },
  { id: "tiro-devanagari-hindi", weights: [400] },
  { id: "yatra-one", weights: [400] },
  { id: "anek-devanagari", weights: [400, 700] },
  { id: "laila", weights: [400, 700] },
  { id: "gotu", weights: [400] },
];

for (const font of COMPANY_FONTS) {
  const root = path.dirname(require.resolve(`@fontsource/${font.id}/package.json`));
  for (const subset of ["devanagari", "latin"]) {
    for (const weight of font.weights) {
      const fileName = `${font.id}-${subset}-${weight}-normal.woff2`;
      await cp(path.join(root, "files", fileName), path.join(publicDir, "fonts", fileName));
    }
  }
}

console.log(
  "reader assets copied to public/pdfjs, public/tessdata, public/tesseract and public/fonts",
);
