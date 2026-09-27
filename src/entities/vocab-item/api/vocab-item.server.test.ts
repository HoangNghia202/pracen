import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { eq } from "drizzle-orm";
import { folders } from "@/shared/api";
import {
  listVocabItemsByFolder,
  createVocabItem,
  createVocabItems,
  getVocabItemById,
  updateVocabItem,
  deleteVocabItem,
} from "./vocab-item.server";

async function makeFolder(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  return folder.id;
}

describe("vocab item entity", () => {
  it("creates a vocab item and lists it back in creation order", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);

    await createVocabItem({ folderId, word: "Dog", meaning: "A domesticated canine" }, db);
    await createVocabItem({ folderId, word: "Cat", meaning: "A domesticated feline" }, db);

    const items = await listVocabItemsByFolder(folderId, db);
    expect(items.map((i) => i.word)).toEqual(["Dog", "Cat"]);
    expect(items[0].example).toBeNull();
  });

  it("bulk-creates vocab items, and returns an empty array for zero rows", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);

    const created = await createVocabItems(
      folderId,
      [
        { word: "Dog", meaning: "A domesticated canine" },
        { word: "Cat", meaning: "A domesticated feline", example: "The cat sleeps." },
      ],
      db
    );
    expect(created).toHaveLength(2);
    expect(await createVocabItems(folderId, [], db)).toEqual([]);
  });

  it("updates a vocab item's fields", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);
    const item = await createVocabItem({ folderId, word: "Dog", meaning: "A domesticated canine" }, db);

    const updated = await updateVocabItem({ id: item.id, meaning: "Man's best friend" }, db);
    expect(updated?.meaning).toBe("Man's best friend");
    expect(updated?.word).toBe("Dog");
  });

  it("deletes a vocab item", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);
    const item = await createVocabItem({ folderId, word: "Dog", meaning: "A domesticated canine" }, db);

    expect(await deleteVocabItem(item.id, db)).toBe(true);
    expect(await getVocabItemById(item.id, db)).toBeNull();
  });

  it("cascades vocab item deletion when the parent folder is deleted", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);
    const item = await createVocabItem({ folderId, word: "Dog", meaning: "A domesticated canine" }, db);

    await db.delete(folders).where(eq(folders.id, folderId));

    expect(await getVocabItemById(item.id, db)).toBeNull();
  });
});
