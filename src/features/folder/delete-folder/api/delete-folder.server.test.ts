import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder, getFolderById } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { deleteFolderAction } from "./delete-folder.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("deleteFolderAction", () => {
  it("deletes a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await deleteFolderAction(folder.id, db);

    expect(result).toMatchObject({ ok: true });
    expect(await getFolderById(folder.id, user.id, db)).toBeNull();
  });

  it("refuses to delete another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await deleteFolderAction(folder.id, db);

    expect(result).toMatchObject({ ok: false });
    expect(await getFolderById(folder.id, owner.id, db)).not.toBeNull();
  });
});
