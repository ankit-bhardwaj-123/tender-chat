import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorPage } from "@/components/editor/editor-page";
import { FolderGate } from "@/components/editor/folder-gate";

export const metadata: Metadata = { title: "Tender" };

export default function Page() {
  return (
    <Suspense>
      <FolderGate>
        <EditorPage />
      </FolderGate>
    </Suspense>
  );
}
