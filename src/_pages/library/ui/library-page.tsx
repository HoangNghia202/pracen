import { Books } from "@phosphor-icons/react/dist/ssr";
import { CreateFolderDialog } from "@/features/create-folder";
import { FolderListToolbar } from "@/features/search-folders";
import { FolderGrid } from "@/widgets/folder-grid";
import type { FolderWithStats } from "@/entities/folder";

interface LibraryPageProps {
  folders: FolderWithStats[];
  hasFilter: boolean;
}

export function LibraryPage({ folders, hasFilter }: LibraryPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-amber-light text-brand-amber-dark">
            <Books weight="fill" className="size-5" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Library</h1>
        </div>
        <CreateFolderDialog />
      </div>
      <FolderListToolbar />
      <FolderGrid folders={folders} hasFilter={hasFilter} />
    </div>
  );
}
