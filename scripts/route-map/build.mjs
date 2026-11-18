import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function walk(root, dir, name) {
  const found = [];
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return found;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(root, rel, name));
    else if (entry.name === name) found.push(rel);
  }
  return found;
}

function resolveImport(root, from, spec) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = toPosix(path.join(path.dirname(from), spec));
  else return null;
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  return (
    candidates.find((c) => {
      const abs = path.join(root, c);
      return fs.existsSync(abs) && fs.statSync(abs).isFile();
    }) ?? null
  );
}

function namesOf(clause) {
  const names = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces) {
    for (const raw of braces[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) names.push(name);
    }
  }
  const head = clause.replace(/\{[^}]*\}/, "").replace(/^(?:import|export)\s+(?:type\s+)?/, "");
  const star = /\*\s+as\s+(\w+)/.exec(head);
  if (star) names.push(`* as ${star[1]}`);
  const fallback = /^(\w+)/.exec(head.trim());
  if (fallback && !["from", "type"].includes(fallback[1])) names.push(fallback[1]);
  return names;
}

function importsOf(src) {
  const found = new Map();
  const add = (spec, names) =>
    found.set(spec, [...new Set([...(found.get(spec) ?? []), ...names])]);
  for (const m of src.matchAll(/((?:import|export)\s[^;]*?)\sfrom\s+["']([^"']+)["']/g)) {
    add(m[2], namesOf(m[1]));
  }
  for (const m of src.matchAll(/import\s+["']([^"']+)["']/g)) add(m[1], []);
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) add(m[1], []);
  return [...found].map(([spec, names]) => ({ spec, names }));
}

function apiCallsOf(src) {
  const calls = new Set();
  for (const m of src.matchAll(/["'`](\/api\/[^"'`\s?#]*)/g)) {
    calls.add(m[1].replace(/\$\{[^}]*\}/g, ":param").replace(/\/$/, ""));
  }
  return [...calls];
}

function layerOf(file) {
  const name = file.split("/").pop();
  if (file.startsWith("app/api/")) return "route";
  if (file.startsWith("app/")) return name === "page.tsx" ? "page" : "layout";
  if (file.startsWith("components/ui/")) return "ui";
  if (file.startsWith("components/")) return "component";
  if (/^use-/.test(name)) return "hook";
  if (file.startsWith("lib/")) return "lib";
  if (file.startsWith("services/")) return "service";
  if (file.startsWith("repositories/")) return "repository";
  if (file === "server/schema.ts") return "schema";
  if (file.startsWith("server/adapters/")) return "adapter";
  if (file.startsWith("server/")) return "server";
  if (file.startsWith("shared/")) return "shared";
  if (file === "types.ts") return "types";
  return "other";
}

function routePath(file) {
  const parts = path.posix
    .dirname(file)
    .split("/")
    .slice(1)
    .filter((part) => !/^\(.*\)$/.test(part));
  return "/" + parts.join("/");
}

function routeRegex(route) {
  const body = route
    .split("/")
    .map((part) => {
      if (/^\[\[\.\.\..*\]\]$/.test(part)) return ".*";
      if (/^\[\.\.\..*\]$/.test(part)) return ".+";
      if (/^\[.*\]$/.test(part)) return "[^/]+";
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${body}$`);
}

function layoutsFor(root, page) {
  const layouts = [];
  let dir = path.posix.dirname(page);
  while (dir.startsWith("app")) {
    const layout = `${dir}/layout.tsx`;
    if (fs.existsSync(path.join(root, layout))) layouts.unshift(layout);
    if (dir === "app") break;
    dir = path.posix.dirname(dir);
  }
  return layouts;
}

export function buildRouteMap(root) {
  const files = {};

  function load(file) {
    if (files[file]) return files[file];
    const src = fs.readFileSync(path.join(root, file), "utf8");
    const entry = {
      layer: layerOf(file),
      lines: src.split("\n").length,
      src,
      imports: [],
      api: [],
    };
    files[file] = entry;
    entry.uses = {};
    for (const { spec, names } of importsOf(src)) {
      const target = resolveImport(root, file, spec);
      if (!target || target === file) continue;
      entry.uses[target] = [...new Set([...(entry.uses[target] ?? []), ...names])];
    }
    entry.imports = Object.keys(entry.uses);
    entry.exports = [
      ...src.matchAll(
        /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|interface|type)\s+(\w+)/g,
      ),
    ].map((m) => m[1]);
    entry.api = apiCallsOf(src);
    for (const target of entry.imports) load(target);
    return entry;
  }

  const backend = walk(root, "app/api", "route.ts")
    .sort()
    .map((file) => {
      const src = load(file).src;
      const destructured = [...src.matchAll(/export\s+const\s*\{([^}]+)\}/g)].flatMap((m) =>
        m[1].split(",").map((name) => name.trim()),
      );
      const methods = METHODS.filter(
        (m) =>
          destructured.includes(m) ||
          new RegExp(`export\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\b)`).test(src),
      );
      return { path: routePath(file), file, methods, roots: [file] };
    });

  const frontend = walk(root, "app", "page.tsx")
    .filter((file) => !file.startsWith("app/api/"))
    .sort()
    .map((file) => {
      for (const layout of layoutsFor(root, file)) load(layout);
      load(file);
      return { path: routePath(file), file, methods: [], roots: [file, ...layoutsFor(root, file)] };
    });

  const matchers = backend.map((r) => ({ path: r.path, re: routeRegex(r.path) }));
  for (const entry of Object.values(files)) {
    entry.api = entry.api
      .map((call) => {
        const probe = call.replace(/:param/g, "x");
        const hit = matchers.find((m) => m.re.test(probe));
        return { call: call.replace(/:param/g, "…"), route: hit ? hit.path : null };
      })
      .filter((a, i, all) => all.findIndex((b) => b.call === a.call) === i);
  }

  return { built: new Date().toISOString(), frontend, backend, files };
}

const isMain =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.cwd();
  const outPath = path.resolve(root, process.argv[2] || "route-map.html");
  const sourceRoot = fs.existsSync(path.join(root, "src")) ? path.join(root, "src") : root;
  const map = buildRouteMap(sourceRoot);
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(dir, "template.html"), "utf8");
  let title = path.basename(root);
  try {
    title = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name || title;
  } catch {}
  const safeTitle = title.replace(/[^\w .@/-]/g, "");
  fs.writeFileSync(
    outPath,
    template
      .replace("__TITLE__", () => safeTitle)
      .replace("__DATA__", () => JSON.stringify(map).replace(/</g, "\\u003c")),
  );
  console.warn(
    `route-map: ${map.frontend.length} pages, ${map.backend.length} API routes, ${Object.keys(map.files).length} files → ${outPath}`,
  );
}
