import type { ReactNode } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { AppShell } from "@/components/shell/app-shell";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <AppShell sidebar={<Sidebar />}>{children}</AppShell>
    </RequireSession>
  );
}
