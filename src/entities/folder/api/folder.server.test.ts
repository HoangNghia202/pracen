import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import {
  listFoldersByUser,
  getFolderById,
  createFolder,
  renameFolder,
  deleteFolder,
  touchFolder,
} from "./folder.server";

async function makeUser(db: Awaited<ReturnType<typeof createTestDb>>, email: string) {
  const user = await createUser({ email, passwordHash: "hash" }, db);
  return user.id;
}

describe("folder entity", () => {
  it("creates a folder and finds it by id, scoped to its owner", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    const otherId = await makeUser(db, "other@example.com");
    const folder = await createFolder({ userId: ownerId, name: "Animals" }, db);

    const found = await getFolderById(folder.id, ownerId, db);
    expect(found?.name).toBe("Animals");

    const wrongOwner = await getFolderById(folder.id, otherId, db);
    expect(wrongOwner).toBeNull();
  });

  it("lists only the requesting user's folders, with word counts", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    const otherId = await makeUser(db, "other@example.com");
    const mine = await createFolder({ userId: ownerId, name: "Animals" }, db);
    await createFolder({ userId: otherId, name: "Someone else's folder" }, db);

    const list = await listFoldersByUser(ownerId, {}, db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: mine.id, name: "Animals", wordCount: 0 });
  });

  it("filters by name search, case-insensitively", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    await createFolder({ userId: ownerId, name: "Animals" }, db);
    await createFolder({ userId: ownerId, name: "Colors" }, db);

    const list = await listFoldersByUser(ownerId, { search: "anim" }, db);
    expect(list.map((f) => f.name)).toEqual(["Animals"]);
  });

  it("sorts by recently created or recently edited", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    const first = await createFolder({ userId: ownerId, name: "First" }, db);
    // Small delay to ensure distinct timestamps for sorting
    await new Promise((r) => setTimeout(r, 10));
    await createFolder({ userId: ownerId, name: "Second" }, db);
    await new Promise((r) => setTimeout(r, 10));
    await touchFolder(first.id, db);

    const byEdited = await listFoldersByUser(ownerId, { sort: "recently-edited" }, db);
    expect(byEdited[0].id).toBe(first.id);

    const byCreated = await listFoldersByUser(ownerId, { sort: "recently-created" }, db);
    expect(byCreated[0].name).toBe("Second");
  });

  it("renames a folder only for its owner", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    const otherId = await makeUser(db, "other@example.com");
    const folder = await createFolder({ userId: ownerId, name: "Animals" }, db);

    const renamed = await renameFolder({ id: folder.id, userId: ownerId, name: "Pets" }, db);
    expect(renamed?.name).toBe("Pets");

    const blocked = await renameFolder({ id: folder.id, userId: otherId, name: "Hijacked" }, db);
    expect(blocked).toBeNull();
  });

  it("deletes a folder only for its owner", async () => {
    const db = await createTestDb();
    const ownerId = await makeUser(db, "owner@example.com");
    const otherId = await makeUser(db, "other@example.com");
    const folder = await createFolder({ userId: ownerId, name: "Animals" }, db);

    const blocked = await deleteFolder({ id: folder.id, userId: otherId }, db);
    expect(blocked).toBe(false);

    const deleted = await deleteFolder({ id: folder.id, userId: ownerId }, db);
    expect(deleted).toBe(true);
    expect(await getFolderById(folder.id, ownerId, db)).toBeNull();
  });
});
