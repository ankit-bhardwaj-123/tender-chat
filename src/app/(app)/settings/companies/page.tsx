import type { Metadata } from "next";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1 px-4 py-8 md:px-8">
      <h1 className="text-xl font-semibold">Companies</h1>
      <p className="text-sm text-muted-foreground">Companies come in Round 2.</p>
    </div>
  );
}
