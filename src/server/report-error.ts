import { logger } from "./logger";

const ALLOWED_CONTEXT_KEY = /^(route|queue|jobId|attempt|[a-z]+Id)$/;
const MESSAGE_MAX_LENGTH = 500;

export type ErrorContext = Record<string, string | number | undefined>;

export interface ErrorReport {
  name: string;
  message: string;
  stack: string | undefined;
  context: Record<string, string | number>;
}

export interface ErrorTransport {
  send(report: ErrorReport): void;
}

export const logTransport: ErrorTransport = {
  send(report) {
    logger.error(
      {
        err: { name: report.name, message: report.message, stack: report.stack },
        ...report.context,
      },
      "unexpected error",
    );
  },
};

export function createErrorReport(error: unknown, context: ErrorContext = {}): ErrorReport {
  const known = error instanceof Error ? error : new Error(String(error));
  const kept: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && ALLOWED_CONTEXT_KEY.test(key)) {
      kept[key] = value;
    }
  }
  return {
    name: known.name,
    message: known.message.slice(0, MESSAGE_MAX_LENGTH),
    stack: known.stack,
    context: kept,
  };
}

export function createErrorReporter(transport: ErrorTransport = logTransport) {
  return {
    capture(error: unknown, context: ErrorContext = {}): void {
      try {
        transport.send(createErrorReport(error, context));
      } catch (sendError) {
        logger.error({ err: sendError }, "couldn't report an error");
      }
    },
  };
}

export type ErrorReporter = ReturnType<typeof createErrorReporter>;

export const errorReporter = createErrorReporter(logTransport);

export function reportError(error: unknown, context: ErrorContext = {}): void {
  errorReporter.capture(error, context);
}
