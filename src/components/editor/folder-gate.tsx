"use client";

import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAllTenders } from "@/lib/tenders";
import { firstLeafId } from "@/shared/folder-tree";

interface FolderGateProps {
  children: ReactNode;
}

export function FolderGate({ children }: FolderGateProps) {
  const { tenderId } = useParams<{ tenderId: string }>();
  const router = useRouter();
  const tenders = useAllTenders();
  const target = tenders.data ? firstLeafId(tenders.data, tenderId) : tenderId;

  useEffect(() => {
    if (target !== tenderId) router.replace(`/t/${target}`);
  }, [target, tenderId, router]);

  return target === tenderId ? children : null;
}
