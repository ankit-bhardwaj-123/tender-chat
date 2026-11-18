const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export function findPlaceholders(html: string): string[] {
  const names: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER)) {
    const name = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (name !== "" && !names.includes(name)) names.push(name);
  }
  return names;
}
