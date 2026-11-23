export function nextPdfName(base: string, names: readonly string[]): string {
  const taken = new Set(names.map((name) => name.normalize("NFC")));
  const clean = base.normalize("NFC");
  if (!taken.has(clean)) return clean;
  for (let number = 2; ; number += 1) {
    const candidate = `${clean} ${number}`;
    if (!taken.has(candidate)) return candidate;
  }
}
