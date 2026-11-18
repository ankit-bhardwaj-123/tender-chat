"use client";

import type { Template } from "@/types";
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
import { deleteTemplate, TEMPLATES_KEY } from "@/lib/templates";

interface DeleteTemplateDialogProps {
  template: Template | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTemplateDialog({ template, onOpenChange }: DeleteTemplateDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (target: Template) => deleteTemplate(target.id),
    onSuccess: () => toast.success("Template deleted."),
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });

  return (
    <AlertDialog open={template !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          <AlertDialogDescription>
            {`“${template?.name ?? ""}” will no longer show in your templates.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (template) remove.mutate(template);
            }}
          >
            Delete template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
