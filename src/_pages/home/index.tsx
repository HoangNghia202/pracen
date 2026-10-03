import { auth } from "@/_app/api-routes/auth";
import { getLibraryStats } from "@/entities/folder";
import { getQuizCountByUser } from "@/entities/quiz";
import { getCompletedAttemptCount, listInProgressAttempts, listRecentCompletedAttempts } from "@/entities/quiz-attempt";
import { HomePage } from "./ui/home-page";

const RECENT_ATTEMPTS_LIMIT = 5;

export default async function Page() {
  const session = await auth();
  const userId = session!.user.id;

  const [libraryStats, quizCount, completedAttemptCount, inProgressAttempts, recentAttempts] = await Promise.all([
    getLibraryStats(userId),
    getQuizCountByUser(userId),
    getCompletedAttemptCount(userId),
    listInProgressAttempts(userId),
    listRecentCompletedAttempts(userId, RECENT_ATTEMPTS_LIMIT),
  ]);

  return (
    <HomePage
      stats={{ ...libraryStats, quizCount, completedAttemptCount }}
      inProgressAttempts={inProgressAttempts}
      recentAttempts={recentAttempts}
    />
  );
}
