import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ClassDeclaration",
          message: "Classes are forbidden in src/server/. Use plain functions and objects.",
        },
      ],
    },
  },
  {
    // Worker must never import server actions or HTTP handlers
    files: ["worker/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*/*.actions", "@/server/*/*.http"],
              message: "Worker must never import server actions or http handlers.",
            },
          ],
        },
      ],
    },
  },
  {
    // Pure rules and shared DTOs cannot import server internals, workers or app
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/**", "@/worker/**", "@/app/**"],
              message: "Rules and shared DTOs must be pure and only import types.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/pdfjs/**",
    "public/tessdata/**",
    "public/tesseract/**",
  ]),
]);

export default eslintConfig;
