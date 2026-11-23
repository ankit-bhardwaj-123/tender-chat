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
  subfolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: HTMLElement;
}

function deleteBody(name: string, subfolders: number): string {
  const also =
    subfolders === 0
      ? ""
      : ` This also deletes ${subfolders} ${subfolders === 1 ? "subfolder" : "subfolders"}.`;
  return `“${name}” will be permanently deleted.${also} This can't be undone.`;
}

export function DeleteTenderDialog({
  tender,
  subfolderIds,
  open,
  onOpenChange,
  returnFocusTo,
}: DeleteTenderDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const gone = new Set([tender.id, ...subfolderIds]);
  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenders/${tender.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Something went wrong, please try again.");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tenders"] });
      const lists = queryClient.getQueriesData<Tender[]>({ queryKey: ["tenders"] });
      queryClient.setQueriesData<Tender[]>({ queryKey: ["tenders"] }, (list) =>
        list?.filter((t) => !gone.has(t.id)),
      );
      return { lists };
    },
    onError: (error, _vars, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(error.message);
    },
    onSuccess: () => {
      for (const id of gone) queryClient.removeQueries({ queryKey: ["tender", id] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tenders"] }),
  });

  const confirm = () => {
    const openId = pathname.startsWith("/t/") ? pathname.split("/")[2] : undefined;
    if (openId !== undefined && gone.has(openId)) {
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
          <AlertDialogDescription>
            {deleteBody(tender.name, subfolderIds.length)}
          </AlertDialogDescription>
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
