import { auth } from "@/_app/api-routes/auth";
import { listFoldersByUser } from "@/entities/folder";
import LibraryPage from "@/_pages/library";

export default async function Page() {
  const session = await auth();
  const folders = await listFoldersByUser(session!.user.id, {});
  return <LibraryPage folders={folders} hasFilter={false} />;
}
