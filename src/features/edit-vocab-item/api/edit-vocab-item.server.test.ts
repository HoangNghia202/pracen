import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { createVocabItem, getVocabItemById } from "@/entities/vocab-item";
import { editVocabItemAction } from "./edit-vocab-item.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("editVocabItemAction", () => {
  it("edits a word inside a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await editVocabItemAction(
      item.id,
      { word: "Dog", meaning: "Man's best friend" },
      db
    );

    expect(result).toMatchObject({ ok: true });
    expect((await getVocabItemById(item.id, db))?.meaning).toBe("Man's best friend");
  });

  it("refuses to edit a word in another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await editVocabItemAction(item.id, { word: "Dog", meaning: "Hijacked" }, db);

    expect(result).toMatchObject({ ok: false });
    expect((await getVocabItemById(item.id, db))?.meaning).toBe("...");
  });

  it("returns not-found for a nonexistent item without touching ownership logic", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await editVocabItemAction("does-not-exist", { word: "Dog", meaning: "..." }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("returns the same not-found error for a nonexistent item and a wrong-owner item", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const nonexistentResult = await editVocabItemAction(
      "does-not-exist",
      { word: "Dog", meaning: "..." },
      db
    );
    const wrongOwnerResult = await editVocabItemAction(item.id, { word: "Dog", meaning: "..." }, db);

    expect(nonexistentResult).toEqual(wrongOwnerResult);
  });
});
