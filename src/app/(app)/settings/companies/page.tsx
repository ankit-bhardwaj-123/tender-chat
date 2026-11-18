import type { Metadata } from "next";
import { CompanyList } from "@/components/companies/company-list";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 md:px-8">
      <CompanyList />
    </div>
  );
}
