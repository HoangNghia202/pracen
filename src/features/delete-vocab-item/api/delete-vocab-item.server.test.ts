import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder, getFolderById } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { createVocabItem, getVocabItemById } from "@/entities/vocab-item";
import { deleteVocabItemAction } from "./delete-vocab-item.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("deleteVocabItemAction", () => {
  it("deletes a word inside a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await deleteVocabItemAction(item.id, db);

    expect(result).toMatchObject({ ok: true });
    expect(await getVocabItemById(item.id, db)).toBeNull();
  });

  it("refuses to delete a word in another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await deleteVocabItemAction(item.id, db);

    expect(result).toMatchObject({ ok: false });
    expect(await getVocabItemById(item.id, db)).not.toBeNull();
  });

  it("returns not-found for a nonexistent item", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await deleteVocabItemAction("does-not-exist", db);

    expect(result).toMatchObject({ ok: false });
  });

  it("returns the same not-found error for a nonexistent item and a wrong-owner item", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const nonexistentResult = await deleteVocabItemAction("does-not-exist", db);
    const wrongOwnerResult = await deleteVocabItemAction(item.id, db);

    expect(nonexistentResult).toEqual(wrongOwnerResult);
  });

  it("touches the folder's updatedAt so it surfaces in recently-edited sort", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const before = await getFolderById(folder.id, user.id, db);
    // Delay to ensure the touch timestamp is distinct
    await new Promise((r) => setTimeout(r, 500));

    const result = await deleteVocabItemAction(item.id, db);

    expect(result).toMatchObject({ ok: true });
    const after = await getFolderById(folder.id, user.id, db);
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });
});
