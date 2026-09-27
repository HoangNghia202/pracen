"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { parseVocabFile, type ParseVocabFileResult } from "../model/parse-vocab-file";
import { importVocabAction } from "../api/import-vocab.server";

export function UploadVocabDialog({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ParseVocabFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    const buffer = await file.arrayBuffer();
    setPreview(parseVocabFile(buffer));
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await importVocabAction(folderId, preview.valid);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setPreview(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreview(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadSimple className="size-4" />
          Import file
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from CSV or Excel</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
            <p className="text-muted-foreground text-xs">
              Columns: word, meaning, example (optional), part of speech (optional).
            </p>
          </div>

          {preview && (
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {preview.valid.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Word</TableHead>
                      <TableHead>Meaning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.word}</TableCell>
                        <TableCell>{row.meaning}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {preview.invalid.length > 0 && (
                <div className="text-destructive text-xs">
                  {preview.invalid.map((row) => (
                    <p key={row.row}>
                      Row {row.row}: {row.reason}
                    </p>
                  ))}
                </div>
              )}
              {preview.valid.length === 0 && preview.invalid.length === 0 && (
                <p className="text-muted-foreground text-sm">No rows found in this file.</p>
              )}
            </div>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!preview || preview.valid.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Importing..." : `Import ${preview?.valid.length ?? 0} words`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
