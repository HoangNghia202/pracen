import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { RenameFolderDialog } from "@/features/folder/rename-folder";
import { DeleteFolderButton } from "@/features/folder/delete-folder";
import { AddVocabDialog } from "@/features/vocab-item/add-vocab-manual";
import { UploadVocabDialog } from "@/features/vocab-item/upload-vocab-file";
import { CreateQuizDialog } from "@/features/quiz/create-quiz";
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
      <Link
        href="/library"
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Library
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{folder.name}</h1>
        <div className="flex items-center gap-1">
          <RenameFolderDialog folderId={folder.id} currentName={folder.name} />
          <DeleteFolderButton folderId={folder.id} folderName={folder.name} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-brand-cream-deep/50 p-3">
        <AddVocabDialog folderId={folder.id} />
        <UploadVocabDialog folderId={folder.id} />
        <CreateQuizDialog folders={[{ id: folder.id, name: folder.name }]} initialFolderId={folder.id} />
      </div>
      <VocabTable items={items} />
    </div>
  );
}
