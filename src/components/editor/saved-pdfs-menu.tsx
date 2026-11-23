"use client";

import type { SavedPdf } from "@/types";
import { ChevronDown, ExternalLink, Files, Pencil } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { savedPdfUrl } from "@/lib/saved-pdfs";

interface SavedPdfsMenuProps {
  tenderId: string;
  pdfs: readonly SavedPdf[] | undefined;
  editingId: string | null;
  disabled: boolean;
  onEdit: (pdf: SavedPdf) => void;
}

const OLD_PDF = "Saved before editing was possible.";

function savedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SavedPdfsMenu({ tenderId, pdfs, editingId, disabled, onEdit }: SavedPdfsMenuProps) {
  const [asking, setAsking] = useState<SavedPdf | null>(null);
  if (!pdfs || pdfs.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disabled}>
            <Files aria-hidden />
            Saved PDFs ({pdfs.length})
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 w-80 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Saved PDFs
          </DropdownMenuLabel>
          {pdfs.map((pdf, index) => (
            <div key={pdf.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <div className="px-2 pt-1.5">
                <p className="truncate text-sm font-medium" title={pdf.name}>
                  {pdf.name}
                  {pdf.id === editingId && (
                    <span className="ml-1.5 rounded-full bg-info-soft px-1.5 text-xs font-normal text-info">
                      editing
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {savedAt(pdf.editedAt ?? pdf.createdAt)}
                  {pdf.editedAt && " (edited)"}
                </p>
                {!pdf.editable && <p className="text-xs text-muted-foreground">{OLD_PDF}</p>}
              </div>
              <div className="flex gap-1 px-1 pb-1">
                <DropdownMenuItem asChild className="flex-1">
                  <a href={savedPdfUrl(tenderId, pdf.id)} target="_blank" rel="noopener">
                    <ExternalLink aria-hidden />
                    Open
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex-1"
                  disabled={!pdf.editable || pdf.id === editingId}
                  onSelect={() => setAsking(pdf)}
                >
                  <Pencil aria-hidden />
                  Edit
                </DropdownMenuItem>
              </div>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this saved PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              Replace what&apos;s in the editor with “{asking?.name}”?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (asking) onEdit(asking);
                setAsking(null);
              }}
            >
              Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
