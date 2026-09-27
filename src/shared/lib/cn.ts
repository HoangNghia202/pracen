// Re-exports shadcn's official `cn` helper (a maintained, compiled drop-in
// replacement for `clsx` + `tailwind-merge`: https://github.com/shadcn-ui/cn).
//
// The shadcn CLI now imports `cn` directly from the `cn` npm package inside
// generated primitives rather than scaffolding a local wrapper. We re-export
// it here so the rest of the app has a stable `@/shared/lib/cn` import that
// matches this project's FSD aliases (see components.json).
export { cn } from "cn";
