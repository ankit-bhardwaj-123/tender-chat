import process from "node:process";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "content",
      "text",
      "body",
      "password",
      "headers.cookie",
      "headers.authorization",
      "*.content",
      "*.text",
      "*.body",
      "*.password",
    ],
    censor: "[redacted]",
  },
});
