import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { listFoldersByUser } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { createFolderAction } from "./create-folder.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("createFolderAction", () => {
  it("creates a folder for the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await createFolderAction({ name: "Animals" }, db);

    expect(result).toMatchObject({ ok: true });
    const folders = await listFoldersByUser(user.id, {}, db);
    expect(folders.map((f) => f.name)).toEqual(["Animals"]);
  });

  it("rejects an invalid name without touching the database", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await createFolderAction({ name: "" }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await createFolderAction({ name: "Animals" }, db);

    expect(result).toMatchObject({ ok: false });
  });
});
