import type { Metadata } from "next";
import { Suspense } from "react";
import { TenderPage } from "@/components/shell/tender-page";

export const metadata: Metadata = { title: "Tender" };

export default function Page() {
  return (
    <Suspense>
      <TenderPage />
    </Suspense>
  );
}
