// Production-only public API for the `api` segment. Never re-export anything
// that pulls in Node-only code (e.g. the PGlite test helper in
// `@/shared/testing`) — `middleware.ts` runs in the Edge Runtime and
// transitively imports this barrel via `auth()`. Next's Edge bundler
// statically rejects the whole module graph if a Node-only import is merely
// reachable from here, even if nothing in it is actually called at runtime.
export * from "./db";
