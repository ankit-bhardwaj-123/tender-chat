"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <CircleAlert className="size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This part of the app hit an unexpected problem. Your tenders are safe.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={retry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Link
          href="/"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Go to the start page
        </Link>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </div>
  );
}
