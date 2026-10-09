import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder, getFolderById } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { renameFolderAction } from "./rename-folder.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("renameFolderAction", () => {
  it("renames a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await renameFolderAction(folder.id, { name: "Pets" }, db);

    expect(result).toMatchObject({ ok: true });
    expect((await getFolderById(folder.id, user.id, db))?.name).toBe("Pets");
  });

  it("refuses to rename another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await renameFolderAction(folder.id, { name: "Hijacked" }, db);

    expect(result).toMatchObject({ ok: false });
    expect((await getFolderById(folder.id, owner.id, db))?.name).toBe("Animals");
  });
});
