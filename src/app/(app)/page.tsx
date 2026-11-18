"use client";

import { FilePlus } from "lucide-react";
import { useState } from "react";
import { NewTenderDialog } from "@/components/shell/new-tender-dialog";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border bg-card px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-info-soft text-info">
          <FilePlus className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Make a quotation for a tender</h1>
          <p className="text-sm text-muted-foreground">
            Start a new tender, or open one from the sidebar.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          New tender
        </Button>
        <NewTenderDialog open={open} onOpenChange={setOpen} />
      </div>
    </div>
  );
}
