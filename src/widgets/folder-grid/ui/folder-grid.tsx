import Link from "next/link";
import { Books } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/shared/lib/format-date";
import type { FolderWithStats } from "@/entities/folder";

interface FolderGridProps {
  folders: FolderWithStats[];
  hasFilter: boolean;
}

export function FolderGrid({ folders, hasFilter }: FolderGridProps) {
  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <Books className="text-muted-foreground size-8" />
        <p className="text-sm">{hasFilter ? "No folders match your search" : "No folders yet"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={`/library/${folder.id}`}
          className="hover:border-primary/40 rounded-lg border p-4 transition-colors"
        >
          <p className="text-lg font-medium">{folder.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {folder.wordCount} {folder.wordCount === 1 ? "word" : "words"} · edited{" "}
            {formatDate(folder.updatedAt)}
          </p>
        </Link>
      ))}
    </div>
  );
}
