import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createFolder } from "@/entities/folder";
import { createUser } from "@/entities/user";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import { importVocabAction } from "./import-vocab.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("importVocabAction", () => {
  it("bulk-inserts previewed rows into a folder owned by the signed-in user", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(
      folder.id,
      [
        { word: "Dog", meaning: "A domesticated canine" },
        { word: "Cat", meaning: "A domesticated feline" },
      ],
      db
    );

    expect(result).toMatchObject({ ok: true, count: 2 });
    expect(await listVocabItemsByFolder(folder.id, db)).toHaveLength(2);
  });

  it("refuses to import into another user's folder", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const attacker = await createUser({ email: "attacker@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: attacker.id } } as never);

    const result = await importVocabAction(folder.id, [{ word: "Dog", meaning: "..." }], db);

    expect(result).toMatchObject({ ok: false });
    expect(await listVocabItemsByFolder(folder.id, db)).toEqual([]);
  });

  it("rejects an empty row list instead of doing nothing silently", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(folder.id, [], db);

    expect(result).toMatchObject({ ok: false });
  });
});
