"use client";

import { Building2, FileText, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShell } from "./shell-context";

export function UserMenu() {
  const router = useRouter();
  const { onNavigate } = useShell();
  const queryClient = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok) throw new Error("We couldn't check your session.");
      return (await res.json()) as Session | null;
    },
    staleTime: 5 * 60_000,
  });
  const logout = useMutation({
    mutationFn: () =>
      fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(["session"], null);
      router.replace("/login");
    },
  });

  if (!session) {
    return <Skeleton className="m-1 size-9 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${session.user.name}`}
        className="m-0.5 flex size-10 items-center justify-center rounded-full outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <UserRound className="size-5" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="flex flex-col font-normal">
          <span className="truncate text-sm font-medium">{session.user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/companies" onClick={onNavigate}>
            <Building2 aria-hidden />
            Companies
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/templates" onClick={onNavigate}>
            <FileText aria-hidden />
            Templates
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
