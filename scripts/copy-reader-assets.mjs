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

console.log(
  "reader assets copied to public/pdfjs, public/tessdata, public/tesseract and public/fonts",
);
