import process from "node:process";
import { z } from "zod";

const EnvSchema = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, hostname: /^.+$/ }),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    NEXT_PUBLIC_FILE_STORE: z.enum(["local", "blob"]).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.NEXT_PUBLIC_FILE_STORE !== "blob" || Boolean(value.BLOB_READ_WRITE_TOKEN),
    {
      message: "BLOB_READ_WRITE_TOKEN is needed when NEXT_PUBLIC_FILE_STORE is blob.",
      path: ["BLOB_READ_WRITE_TOKEN"],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
