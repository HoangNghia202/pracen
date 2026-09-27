"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { addVocabManualAction } from "../api/add-vocab.server";

export function AddVocabDialog({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    const input = {
      word: String(formData.get("word") ?? ""),
      meaning: String(formData.get("meaning") ?? ""),
      example: String(formData.get("example") ?? ""),
      partOfSpeech: String(formData.get("partOfSpeech") ?? ""),
    };

    try {
      const result = await addVocabManualAction(folderId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" />
          Add word
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add word</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="word">Word</Label>
            <Input id="word" name="word" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="meaning">Meaning</Label>
            <Input id="meaning" name="meaning" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="example">Example (optional)</Label>
            <Input id="example" name="example" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="partOfSpeech">Part of speech (optional)</Label>
            <Input id="partOfSpeech" name="partOfSpeech" placeholder="noun, verb, adjective..." />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add word"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
