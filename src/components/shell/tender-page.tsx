"use client";

import type { Tender } from "@/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const NOT_FOUND = "not_found";

export function TenderPage() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const tender = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}`);
      if (res.status === 404) throw new Error(NOT_FOUND);
      if (!res.ok) throw new Error("Couldn't load the tender.");
      return (await res.json()) as Tender;
    },
    retry: false,
  });

  if (tender.isPending) {
    return (
      <div role="status" aria-label="Loading…" className="flex flex-col gap-3 p-8">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  if (tender.isError) {
    const missing = tender.error.message === NOT_FOUND;
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <h1 className="text-lg font-semibold">
          {missing ? "Tender not found" : "Couldn't load the tender."}
        </h1>
        {missing ? (
          <Link
            href="/"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to the start page
          </Link>
        ) : (
          <Button variant="outline" onClick={() => void tender.refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-8">
      <h1 className="text-xl font-semibold">{tender.data.name}</h1>
      <p className="text-sm text-muted-foreground">The editor comes in a later round.</p>
    </div>
  );
}
