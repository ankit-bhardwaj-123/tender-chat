import type { NextConfig } from "next";
import { TEMPLATE_FILE_POLICY } from "./src/shared/template-file-policy";

// Set explicitly so Next doesn't treat a lockfile in a parent folder as the project root.
const projectRoot = process.cwd();
const isDev = process.env.NODE_ENV === "development";

// Nonce-based CSP needs dynamic rendering, which cacheComponents/partial prerendering rule out
// (docs/app/guides/content-security-policy "Without Nonces"), so scripts keep 'unsafe-inline'.
// worker-src allows the pdf.js worker; frame-ancestors 'none' blocks clickjacking.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const printerFiles = [
  "./node_modules/@sparticuz/chromium/bin/**",
  "./node_modules/playwright-core/browsers.json",
  "./node_modules/@fontsource/*/files/*-{latin,devanagari}-{400,700}-normal.woff2",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/templates/:id/file",
        headers: [{ key: "Content-Security-Policy", value: TEMPLATE_FILE_POLICY }],
      },
    ];
  },
  cacheComponents: true,
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    "/api/tenders/\\[id\\]/pdf": printerFiles,
  },
  outputFileTracingExcludes: {
    "**": [
      "./storage/**/*",
      "./public/**/*",
      "./archive/**/*",
      "./tests/**/*",
      "./scripts/**/*",
      "./docs/**/*",
    ],
  },
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
