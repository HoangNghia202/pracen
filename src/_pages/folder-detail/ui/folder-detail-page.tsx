import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { RenameFolderDialog } from "@/features/rename-folder";
import { DeleteFolderButton } from "@/features/delete-folder";
import { VocabTable } from "@/widgets/vocab-table";
import type { Folder } from "@/entities/folder";
import type { VocabItem } from "@/entities/vocab-item";

interface FolderDetailPageProps {
  folder: Folder;
  items: VocabItem[];
}

export function FolderDetailPage({ folder, items }: FolderDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/library" className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to Library
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
        <div className="flex items-center gap-1">
          <RenameFolderDialog folderId={folder.id} currentName={folder.name} />
          <DeleteFolderButton folderId={folder.id} folderName={folder.name} />
        </div>
      </div>
      <VocabTable items={items} />
    </div>
  );
}
