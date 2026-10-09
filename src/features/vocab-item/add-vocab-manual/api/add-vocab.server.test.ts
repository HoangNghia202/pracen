import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import { addVocabManualAction } from "./add-vocab.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("addVocabManualAction", () => {
  it("adds a word to a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await addVocabManualAction(
      folder.id,
      { word: "Dog", meaning: "A domesticated canine" },
      db
    );

    expect(result).toMatchObject({ ok: true });
    const items = await listVocabItemsByFolder(folder.id, db);
    expect(items.map((i) => i.word)).toEqual(["Dog"]);
  });

  it("refuses to add to another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await addVocabManualAction(
      folder.id,
      { word: "Dog", meaning: "A domesticated canine" },
      db
    );

    expect(result).toMatchObject({ ok: false });
    expect(await listVocabItemsByFolder(folder.id, db)).toEqual([]);
  });
});
