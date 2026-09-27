import { revalidatePath } from "next/cache";

// `revalidatePath` requires a request-scoped Next.js render context and
// throws when invoked outside one (e.g. a unit test calling a Server Action
// directly as a plain function). Revalidation failing here is best-effort
// cache-freshness only and must never turn an otherwise-successful mutation
// into a reported failure.
export function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    // ignore — see above
  }
}
