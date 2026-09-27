import { auth } from "@/_app/api-routes/auth";
import { listFoldersByUser, type FolderSort } from "@/entities/folder";
import LibraryPage from "@/_pages/library";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: FolderSort }>;
}) {
  const { q, sort } = await searchParams;
  const session = await auth();
  const folders = await listFoldersByUser(session!.user.id, { search: q, sort });
  return <LibraryPage folders={folders} hasFilter={Boolean(q)} />;
}
