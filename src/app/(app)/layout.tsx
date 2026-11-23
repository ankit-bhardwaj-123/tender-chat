import { type ReactNode, Suspense } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { AppShell } from "@/components/shell/app-shell";
import { FontFaces } from "@/components/shell/font-faces";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <FontFaces />
      <AppShell
        sidebar={
          <Suspense fallback={<div className="h-full bg-sidebar" />}>
            <Sidebar />
          </Suspense>
        }
      >
        {children}
      </AppShell>
    </RequireSession>
  );
}
