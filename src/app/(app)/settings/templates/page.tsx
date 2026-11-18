import type { Metadata } from "next";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1 px-4 py-8 md:px-8">
      <h1 className="text-xl font-semibold">Templates</h1>
      <p className="text-sm text-muted-foreground">Templates come in a later round.</p>
    </div>
  );
}
