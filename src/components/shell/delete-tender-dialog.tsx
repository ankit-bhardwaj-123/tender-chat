"use client";

import type { Tender } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
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

interface DeleteTenderDialogProps {
  tender: Tender;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: HTMLElement;
}

function deleteBody(name: string): string {
  return `“${name}” will be permanently deleted. This can't be undone.`;
}

export function DeleteTenderDialog({
  tender,
  open,
  onOpenChange,
  returnFocusTo,
}: DeleteTenderDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenders/${tender.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Something went wrong, please try again.");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tenders"] });
      const lists = queryClient.getQueriesData<Tender[]>({ queryKey: ["tenders"] });
      queryClient.setQueriesData<Tender[]>({ queryKey: ["tenders"] }, (list) =>
        list?.filter((t) => t.id !== tender.id),
      );
      return { lists };
    },
    onError: (error, _vars, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(error.message);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["tender", tender.id] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tenders"] }),
  });

  const confirm = () => {
    if (pathname === `/t/${tender.id}` || pathname.startsWith(`/t/${tender.id}/`)) {
      router.push("/");
    }
    remove.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusTo.isConnected) returnFocusTo.focus();
          else document.getElementById("main-content")?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this tender?</AlertDialogTitle>
          <AlertDialogDescription>{deleteBody(tender.name)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Delete tender
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
