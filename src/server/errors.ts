export type ErrorKind = "unauthorized" | "not_found" | "invalid" | "unavailable";

export interface AppError extends Error {
  kind: ErrorKind;
}

export function createAppError(kind: ErrorKind, message: string): AppError {
  const error = new Error(message) as AppError;
  error.name = "AppError";
  error.kind = kind;
  return error;
}

export function unauthorized(message = "Sign in first."): AppError {
  return createAppError("unauthorized", message);
}

export function notFound(message = "Not found."): AppError {
  return createAppError("not_found", message);
}

export function invalid(message: string): AppError {
  return createAppError("invalid", message);
}

export function unavailable(message: string, cause?: unknown): AppError {
  const error = createAppError("unavailable", message);
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    "kind" in error &&
    ((error as AppError).kind === "unauthorized" ||
      (error as AppError).kind === "not_found" ||
      (error as AppError).kind === "invalid" ||
      (error as AppError).kind === "unavailable")
  );
}
