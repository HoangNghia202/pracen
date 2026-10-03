import Link from "next/link";
import { Books, FolderSimple } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/shared/lib/format-date";
import type { FolderWithStats } from "@/entities/folder";

interface FolderGridProps {
  folders: FolderWithStats[];
  hasFilter: boolean;
}

export function FolderGrid({ folders, hasFilter }: FolderGridProps) {
  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-amber-light text-brand-amber-dark">
          <Books className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">
          {hasFilter ? "No folders match your search" : "No folders yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={`/library/${folder.id}`}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:border-brand-amber/60 hover:shadow-brand"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-amber-light text-brand-amber-dark transition-colors group-hover:bg-brand-amber group-hover:text-brand-ink">
            <FolderSimple weight="fill" className="size-5" />
          </span>
          <p className="font-heading text-base font-medium text-foreground">{folder.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {folder.wordCount} {folder.wordCount === 1 ? "word" : "words"} · edited{" "}
            {formatDate(folder.updatedAt)}
          </p>
        </Link>
      ))}
    </div>
  );
}
