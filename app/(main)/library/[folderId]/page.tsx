import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import FolderDetailPage from "@/_pages/folder-detail";

export default async function Page({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const session = await auth();
  const folder = await getFolderById(folderId, session!.user.id);
  if (!folder) {
    notFound();
  }
  const items = await listVocabItemsByFolder(folder.id);
  return <FolderDetailPage folder={folder} items={items} />;
}
