const SITE = "http://same-site.invalid";

export function safeNextPath(next: string | null): string {
  const url = next?.startsWith("/") ? URL.parse(next, SITE) : null;
  if (url?.origin !== SITE || url.pathname === "/login") return "/";
  return url.pathname + url.search + url.hash;
}
