"use client";

import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useQuizListParams } from "../model/use-quiz-list-params";

interface QuizListToolbarProps {
  folders: { id: string; name: string }[];
}

export function QuizListToolbar({ folders }: QuizListToolbarProps) {
  const { search, setSearch, folderId, setFolderId } = useQuizListParams();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Input
        placeholder="Search quizzes"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="sm:max-w-xs"
      />
      <Select value={folderId || "all"} onValueChange={(value) => setFolderId(value === "all" ? "" : value)}>
        <SelectTrigger className="sm:w-52">
          <SelectValue placeholder="All folders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All folders</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
