"use client";

import type { Session } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok) throw new Error("We couldn't check your session.");
      return (await res.json()) as Session | null;
    },
    staleTime: 5 * 60_000,
  });
  const signedOut = session.isSuccess && session.data === null;

  useEffect(() => {
    if (!signedOut) return;
    const here = window.location.pathname + window.location.search;
    router.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
  }, [signedOut, router]);

  if (session.isError) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm"
      >
        <p>{"We couldn't check your session."}</p>
        <Button variant="outline" onClick={() => void session.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (signedOut) return null;

  return children;
}
