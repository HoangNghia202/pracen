import { auth } from "@/_app/api-routes/auth";
import { listQuizzesByUser } from "@/entities/quiz";
import { listFoldersByUser } from "@/entities/folder";
import { QuizListPage } from "./ui/quiz-list-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folderId?: string }>;
}) {
  const { q, folderId } = await searchParams;
  const session = await auth();
  const [quizzes, folders] = await Promise.all([
    listQuizzesByUser(session!.user.id, { search: q, folderId }),
    listFoldersByUser(session!.user.id, {}),
  ]);
  return (
    <QuizListPage
      quizzes={quizzes}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      hasFilter={Boolean(q) || Boolean(folderId)}
    />
  );
}
