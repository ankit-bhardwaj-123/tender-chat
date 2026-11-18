"use client";

import { createContext, use } from "react";

export interface ShellState {
  readonly isDesktop: boolean;
  readonly sidebarCollapsed: boolean;
  toggleSidebar(): void;
  onNavigate(): void;
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const shell = use(ShellContext);
  if (!shell) throw new Error("useShell must be used inside <AppShell>");
  return shell;
}
