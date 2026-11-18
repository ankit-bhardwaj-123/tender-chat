"use client";

import { Menu, PanelLeftOpen } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Layout,
  type LayoutChangedMeta,
  useGroupRef,
  usePanelRef,
} from "react-resizable-panels";
import { IconButton } from "@/components/ui/icon-button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/hooks";
import { loadShellLayout, saveShellLayout } from "@/lib/shell-layout";
import { ShellContext, type ShellState } from "./shell-context";

const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TOGGLE_ANIMATION_MS = 200;

interface ShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: ShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const main = (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
    >
      {children}
    </main>
  );
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {isDesktop ? (
        <DesktopShell sidebar={sidebar}>{main}</DesktopShell>
      ) : (
        <MobileShell sidebar={sidebar}>{main}</MobileShell>
      )}
    </>
  );
}

function DesktopShell({ sidebar, children }: ShellProps) {
  const groupRef = useGroupRef();
  const sidebarRef = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);
  const saveNextLayout = useRef(false);

  useEffect(() => {
    const saved = loadShellLayout();
    if (saved) groupRef.current?.setLayout(saved);
  }, [groupRef]);

  const onLayoutChanged = useCallback((layout: Layout, meta: LayoutChangedMeta) => {
    if (!meta.isUserInteraction && !saveNextLayout.current) return;
    saveNextLayout.current = false;
    saveShellLayout(meta.requestedLayout ?? layout);
  }, []);

  const [animating, setAnimating] = useState(false);
  const sidebarBoxRef = useRef<HTMLDivElement>(null);
  const showButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggle = useRef(false);

  useEffect(() => {
    if (!focusAfterToggle.current) return;
    focusAfterToggle.current = false;
    if (collapsed) showButtonRef.current?.focus();
    else sidebarBoxRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [collapsed]);

  const toggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    saveNextLayout.current = true;
    focusAfterToggle.current = true;
    if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setAnimating(true);
      window.setTimeout(() => setAnimating(false), TOGGLE_ANIMATION_MS + 50);
    }
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [sidebarRef]);

  const shell = useMemo<ShellState>(
    () => ({ isDesktop: true, sidebarCollapsed: collapsed, toggleSidebar, onNavigate: () => {} }),
    [collapsed, toggleSidebar],
  );

  return (
    <ShellContext value={shell}>
      <div
        className={`h-dvh ${animating ? "[&>[data-group]>[data-panel]]:transition-[flex-grow] [&>[data-group]>[data-panel]]:duration-200 [&>[data-group]>[data-panel]]:ease-out" : ""}`}
      >
        <ResizablePanelGroup
          orientation="horizontal"
          groupRef={groupRef}
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarRef}
            defaultSize={280}
            minSize={220}
            maxSize={420}
            collapsible
            collapsedSize={0}
            onResize={() => setCollapsed(sidebarRef.current?.isCollapsed() ?? false)}
          >
            <div
              ref={sidebarBoxRef}
              className={`h-full w-full overflow-hidden ${collapsed && !animating ? "invisible" : ""}`}
              inert={collapsed}
            >
              <div className="h-full min-w-[220px]">{sidebar}</div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="main">
            <div className="relative flex h-full min-w-0 flex-col">
              {collapsed && (
                <IconButton
                  ref={showButtonRef}
                  label="Show sidebar"
                  size="icon-sm"
                  variant="outline"
                  onClick={toggleSidebar}
                  className="absolute top-3 left-3 z-10 bg-card shadow-sm duration-200 animate-in fade-in"
                >
                  <PanelLeftOpen />
                </IconButton>
              )}
              {children}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ShellContext>
  );
}

function MobileShell({ sidebar, children }: ShellProps) {
  const [open, setOpen] = useState(false);

  const shell = useMemo<ShellState>(
    () => ({
      isDesktop: false,
      sidebarCollapsed: true,
      toggleSidebar: () => setOpen((o) => !o),
      onNavigate: () => setOpen(false),
    }),
    [],
  );

  return (
    <ShellContext value={shell}>
      <div className="flex h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <IconButton label="Open menu" size="icon-sm">
                <Menu />
              </IconButton>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-80 gap-0 p-0"
              showCloseButton={false}
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Tenders</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        </header>
        {children}
      </div>
    </ShellContext>
  );
}
