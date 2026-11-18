"use client";

import type { Session } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeNextPath } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AuthCard } from "./auth-card";
import { FormErrorBanner } from "./form-error-banner";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const callbackError = params.get("error") ? "Couldn't sign in, please try again." : null;
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok) throw new Error("We couldn't check your session.");
      return (await res.json()) as Session | null;
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (session.data) router.replace(next);
  }, [session.data, next, router]);

  const google = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: next, errorCallbackURL: "/login" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.url !== "string") {
        throw new Error("Google sign-in isn't available right now. Please try again later.");
      }
      window.location.href = body.url;
    },
  });

  return (
    <AuthCard title="Sign in">
      <div className="flex flex-col gap-4">
        <FormErrorBanner
          key={google.submittedAt}
          message={google.error?.message ?? (google.isIdle ? callbackError : null)}
        />
        <Button type="button" disabled={google.isPending} onClick={() => google.mutate()}>
          Continue with Google
        </Button>
      </div>
    </AuthCard>
  );
}
