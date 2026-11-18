"use client";

import type { Company } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { COMPANIES_KEY, deleteCompany } from "@/lib/companies";

interface DeleteCompanyDialogProps {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCompanyDialog({ company, onOpenChange }: DeleteCompanyDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (target: Company) => deleteCompany(target.id),
    onSuccess: () => toast.success("Company deleted."),
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: COMPANIES_KEY }),
  });

  return (
    <AlertDialog open={company !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this company?</AlertDialogTitle>
          <AlertDialogDescription>
            {`“${company?.name ?? ""}” will no longer show in your companies.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (company) remove.mutate(company);
            }}
          >
            Delete company
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
