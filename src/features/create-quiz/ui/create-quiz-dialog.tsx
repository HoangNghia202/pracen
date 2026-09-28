"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { getFolderWordsAction } from "../api/get-folder-words.server";
import { createQuizAction } from "../api/create-quiz.server";
import type { VocabItem } from "@/entities/vocab-item";

type QuestionType = "meaning" | "word" | "sentence";

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "meaning", label: "Meaning" },
  { value: "word", label: "Word" },
  { value: "sentence", label: "Sentence" },
];

interface CreateQuizDialogProps {
  folders: { id: string; name: string }[];
  initialFolderId?: string;
}

export function CreateQuizDialog({ folders, initialFolderId }: CreateQuizDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState(initialFolderId ?? "");
  const [name, setName] = useState("");
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [questionTypes, setQuestionTypes] = useState<Set<QuestionType>>(new Set());
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !folderId) return;
    setIsLoadingWords(true);
    setError(null);
    getFolderWordsAction(folderId)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setWords([]);
          return;
        }
        setWords(result.items);
        setSelectedWordIds(new Set(result.items.map((item) => item.id)));
      })
      .finally(() => setIsLoadingWords(false));
  }, [open, folderId]);

  function toggleWord(id: string) {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllWords() {
    setSelectedWordIds((prev) => (prev.size === words.length ? new Set() : new Set(words.map((w) => w.id))));
  }

  function toggleQuestionType(type: QuestionType) {
    setQuestionTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function resetForm() {
    setName("");
    setWords([]);
    setSelectedWordIds(new Set());
    setQuestionTypes(new Set());
    setShuffleQuestions(false);
    setShuffleAnswers(false);
    setError(null);
    if (!initialFolderId) setFolderId("");
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createQuizAction({
        folderId,
        name,
        vocabItemIds: [...selectedWordIds],
        questionTypes: [...questionTypes],
        shuffleQuestions,
        shuffleAnswers,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      resetForm();
      router.push(`/quiz/${result.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    folderId.length > 0 && name.trim().length > 0 && selectedWordIds.size > 0 && questionTypes.size > 0 && !isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Create quiz
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create quiz</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {!initialFolderId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder">Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger id="folder">
                  <SelectValue placeholder="Choose a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="quiz-name">Quiz name</Label>
            <Input id="quiz-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>

          {folderId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Words</Label>
                {words.length > 0 && (
                  <button type="button" className="text-muted-foreground text-xs underline" onClick={toggleAllWords}>
                    {selectedWordIds.size === words.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {isLoadingWords && <p className="text-muted-foreground text-xs">Loading words...</p>}
              {!isLoadingWords && words.length === 0 && (
                <p className="text-muted-foreground text-xs">This folder has no words yet.</p>
              )}
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {words.map((word) => (
                  <label key={word.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedWordIds.has(word.id)} onCheckedChange={() => toggleWord(word.id)} />
                    {word.word} — {word.meaning}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Question types</Label>
            <div className="flex flex-col gap-2">
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={questionTypes.has(option.value)}
                    onCheckedChange={() => toggleQuestionType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="shuffle-questions">Shuffle question order</Label>
            <Switch id="shuffle-questions" checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shuffle-answers">Shuffle answer choices</Label>
            <Switch id="shuffle-answers" checked={shuffleAnswers} onCheckedChange={setShuffleAnswers} />
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
