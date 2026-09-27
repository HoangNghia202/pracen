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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <CreateFolderDialog />
      </div>
      <FolderListToolbar />
      <FolderGrid folders={folders} hasFilter={hasFilter} />
    </div>
  );
}
