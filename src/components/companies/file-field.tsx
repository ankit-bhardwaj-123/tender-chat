"use client";

import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export interface SavedFile {
  fileName: string;
  size: number;
  href: string;
}

interface FileFieldProps {
  label: string;
  accept: "pdf" | "jpg" | "html";
  removable?: boolean;
  file: File | null;
  saved: SavedFile | null;
  onChange: (file: File | null) => void;
  onRemoveSaved: () => void;
  disabled?: boolean;
}

interface ShownFile {
  name: string;
  size: number;
  href: string | null;
  isNew: boolean;
}

const ACCEPT = {
  pdf: { attribute: ".pdf,application/pdf", hint: "PDF" },
  jpg: { attribute: ".jpg,.jpeg,image/jpeg", hint: "JPG" },
  html: { attribute: ".html,.htm,text/html", hint: "HTML" },
};

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileField({
  label,
  accept,
  file,
  saved,
  onChange,
  onRemoveSaved,
  disabled,
  removable = true,
}: FileFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const kind = ACCEPT[accept];
  const pick = () => inputRef.current?.click();
  const shown: ShownFile | null = file
    ? { name: file.name, size: file.size, href: null, isNew: true }
    : saved
      ? { name: saved.fileName, size: saved.size, href: saved.href, isNew: false }
      : null;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">({kind.hint})</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={kind.attribute}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onChange(picked);
          e.target.value = "";
        }}
      />
      {shown ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileText className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm" title={shown.name}>
              {shown.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {fileSize(shown.size)}
              {shown.isNew && <span className="text-primary"> · New</span>}
            </span>
          </div>
          {shown.href && (
            <IconButton label={`Open ${label}`} size="icon-sm" asChild>
              <a href={shown.href} target="_blank" rel="noreferrer">
                <ExternalLink />
              </a>
            </IconButton>
          )}
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={pick}>
            Replace
          </Button>
          {(file || removable) && (
            <IconButton
              type="button"
              label={`Remove ${label}`}
              size="icon-sm"
              className="text-muted-foreground"
              disabled={disabled}
              onClick={() => (file ? onChange(null) : onRemoveSaved())}
            >
              <X />
            </IconButton>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm text-muted-foreground outline-none hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <Upload className="size-4 shrink-0" aria-hidden />
          <span>Upload {kind.hint}</span>
        </button>
      )}
    </div>
  );
}
