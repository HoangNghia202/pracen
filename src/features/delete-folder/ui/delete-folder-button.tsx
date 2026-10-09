"use client";

import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { confirm } from "@/shared/ui/confirm-dialog";
import { deleteFolderAction } from "../api/delete-folder.server";

export function DeleteFolderButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const router = useRouter();

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete "${folderName}"?`,
      description:
        "This permanently deletes the folder, every word inside it, and every quiz built from it. This can't be undone.",
      confirmText: "Delete",
      confirmVariant: "destructive",
    });
    if (!ok) return;

    const result = await deleteFolderAction(folderId);
    if (result.ok) {
      router.push("/library");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Delete folder" onClick={handleDelete}>
      <Trash className="size-4" />
    </Button>
  );
}
