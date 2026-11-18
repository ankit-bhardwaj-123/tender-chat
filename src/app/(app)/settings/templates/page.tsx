import type { Metadata } from "next";
import { TemplateList } from "@/components/templates/template-list";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 md:px-8">
      <TemplateList />
    </div>
  );
}
