"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
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
import {
  parseVocabFile,
  type ParsedVocabRow,
  type ParseVocabFileResult,
} from "../model/parse-vocab-file";
import { MAX_IMPORT_ROWS } from "../model/schema";
import { downloadVocabTemplate } from "../model/vocab-template";
import { importVocabAction } from "../api/import-vocab.server";
import { generateVocabExamplesAction } from "../api/generate-examples.server";

function pluralizeWords(count: number): string {
  return `${count} word${count === 1 ? "" : "s"}`;
}

export function UploadVocabDialog({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ParseVocabFileResult | null>(null);
  const [examples, setExamples] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ignores results from a generation request superseded by a newer file or a closed dialog.
  const generationId = useRef(0);

  const tooMany = (preview?.valid.length ?? 0) > MAX_IMPORT_ROWS;

  function reset() {
    generationId.current += 1;
    setPreview(null);
    setExamples([]);
    setMissingCount(0);
    setIsGenerating(false);
  }

  async function generateMissingExamples(rows: ParsedVocabRow[]) {
    const pending = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.example);
    if (pending.length === 0) return;

    const requestId = ++generationId.current;
    setIsGenerating(true);

    let generated: (string | null)[];
    try {
      const result = await generateVocabExamplesAction(
        pending.map(({ row }) => ({ word: row.word, type: row.type, meaning: row.meaning }))
      );
      generated = result.ok ? result.examples : pending.map(() => null);
    } catch {
      generated = pending.map(() => null);
    }

    if (requestId !== generationId.current) return;
    setExamples((prev) => {
      const next = [...prev];
      pending.forEach(({ index }, k) => {
        const example = generated[k];
        if (example) next[index] = example;
      });
      return next;
    });
    setMissingCount(generated.filter((example) => !example).length);
    setIsGenerating(false);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    reset();
    const id = generationId.current;

    let parsed: ParseVocabFileResult;
    try {
      const buffer = await file.arrayBuffer();
      if (generationId.current !== id) return;
      parsed = parseVocabFile(buffer);
    } catch {
      if (generationId.current !== id) return;
      setError("Could not read this file. Please make sure it's a valid CSV or Excel file.");
      return;
    }

    setPreview(parsed);
    setExamples(parsed.valid.map((row) => row.example ?? ""));

    if (parsed.valid.length > MAX_IMPORT_ROWS) {
      setError(
        `This file has ${parsed.valid.length} words. You can import at most ${MAX_IMPORT_ROWS} at a time.`
      );
      return;
    }

    await generateMissingExamples(parsed.valid);
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    const rows: ParsedVocabRow[] = preview.valid.map((row, index) => {
      const example = examples[index]?.trim();
      return {
        word: row.word,
        type: row.type,
        meaning: row.meaning,
        ...(example ? { example } : {}),
        ...(row.partOfSpeech ? { partOfSpeech: row.partOfSpeech } : {}),
      };
    });

    try {
      const result = await importVocabAction(folderId, rows);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
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
        if (!next) {
          reset();
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadSimple className="size-4" />
          Import file
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import from CSV or Excel</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
            <p className="text-muted-foreground text-xs">
              Required: Word, Type, Meaning. Optional: Example, Part of speech. Max {MAX_IMPORT_ROWS} rows.
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto self-start p-0"
              onClick={downloadVocabTemplate}
            >
              <DownloadSimple className="size-4" />
              Download Excel template
            </Button>
          </div>

          {isGenerating && (
            <p className="text-muted-foreground text-sm">Generating examples…</p>
          )}

          {preview && (
            <div className="flex max-h-[55vh] min-h-0 flex-col gap-3 overflow-y-auto">
              {preview.valid.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Word</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Meaning</TableHead>
                      <TableHead>Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.word}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.meaning}</TableCell>
                        <TableCell className="min-w-64">
                          <Input
                            aria-label={`Example for ${row.word}`}
                            value={examples[index] ?? ""}
                            disabled={isGenerating}
                            onChange={(event) => {
                              const value = event.target.value;
                              setExamples((prev) => {
                                const next = [...prev];
                                next[index] = value;
                                return next;
                              });
                            }}
                          />
                        </TableCell>
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

          {missingCount > 0 && (
            <p className="text-muted-foreground text-xs">
              Couldn&apos;t generate examples for {pluralizeWords(missingCount)}. You can add them manually.
            </p>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={
              !preview || preview.valid.length === 0 || tooMany || isGenerating || isSubmitting
            }
          >
            {isSubmitting
              ? "Importing..."
              : isGenerating
                ? "Generating examples..."
                : `Import ${preview?.valid.length ?? 0} words`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
