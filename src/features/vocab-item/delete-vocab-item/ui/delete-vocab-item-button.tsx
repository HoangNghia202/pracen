"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { deleteVocabItemAction } from "../api/delete-vocab-item.server";

export function DeleteVocabItemButton({ itemId, word }: { itemId: string; word: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    setIsDeleting(true);
    try {
      const result = await deleteVocabItemAction(itemId);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${word}`}
      onClick={handleClick}
      disabled={isDeleting}
    >
      <Trash className="size-4" />
    </Button>
  );
}
