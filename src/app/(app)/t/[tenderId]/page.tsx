import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorPage } from "@/components/editor/editor-page";

export const metadata: Metadata = { title: "Tender" };

export default function Page() {
  return (
    <Suspense>
      <EditorPage />
    </Suspense>
  );
}
