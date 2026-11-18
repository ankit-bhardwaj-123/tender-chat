import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

interface HeaderPair {
  key: string;
  value: string;
}

const TEMPLATE_FILE_PATH = "/api/templates/00000000-0000-4000-8000-000000000000/file";

async function configHeadersFor(pathname: string): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const sent = new Map<string, string>();
  for (const rule of rules) {
    if (!getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname)) continue;
    for (const header of rule.headers as HeaderPair[])
      sent.set(header.key.toLowerCase(), header.value);
  }
  return sent;
}

async function policySentFor(pathname: string, routePolicy: string): Promise<string> {
  return (await configHeadersFor(pathname)).get("content-security-policy") ?? routePolicy;
}

describe("security headers", () => {
  it("keeps the strict app policy on normal pages", async () => {
    const policy = (await configHeadersFor("/settings/templates")).get("content-security-policy");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("sends a sandbox policy when a template file is opened", async () => {
    const policy = await policySentFor(TEMPLATE_FILE_PATH, "sandbox");
    expect(policy.split(";").map((part) => part.trim())).toContain("sandbox");
  });
});
