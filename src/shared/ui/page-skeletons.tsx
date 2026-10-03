import { Skeleton } from "./skeleton";

// Shared route-level loading skeletons, wired up via each route segment's
// `loading.tsx`. Next.js shows these immediately on navigation (before the
// new Server Component has finished fetching data or even finished
// compiling in dev), so the UI never looks frozen during a route change.

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function GridPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-full max-w-xs" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function QuizPlayerSkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-6 w-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
