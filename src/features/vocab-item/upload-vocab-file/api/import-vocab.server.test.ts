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
        { word: "Dog", type: "noun", meaning: "A domesticated canine" },
        { word: "Cat", type: "noun", meaning: "A domesticated feline" },
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

    const result = await importVocabAction(folder.id, [{ word: "Dog", type: "noun", meaning: "..." }], db);

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

  it("rejects rows with an empty word or meaning instead of inserting them", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(
      folder.id,
      [
        { word: "Dog", type: "noun", meaning: "A domesticated canine" },
        { word: "", type: "noun", meaning: "Missing a word" },
      ],
      db
    );

    expect(result).toMatchObject({ ok: false });
    expect(await listVocabItemsByFolder(folder.id, db)).toEqual([]);
  });

  it("persists the type of each imported row", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    await importVocabAction(
      folder.id,
      [{ word: "Run", type: "verb", meaning: "Move fast", example: "I run every day." }],
      db
    );

    const [item] = await listVocabItemsByFolder(folder.id, db);
    expect(item).toMatchObject({ word: "Run", type: "verb", example: "I run every day." });
  });

  it("rejects rows without a type", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(
      folder.id,
      [{ word: "Dog", type: "", meaning: "A canine" }],
      db
    );

    expect(result).toEqual({ ok: false, error: "Type is required" });
  });

  it("rejects more than 100 rows", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const rows = Array.from({ length: 101 }, (_, i) => ({ word: `w${i}`, type: "noun", meaning: "m" }));
    const result = await importVocabAction(folder.id, rows, db);

    expect(result).toEqual({ ok: false, error: "Too many rows to import at once (max 100)" });
    expect(await listVocabItemsByFolder(folder.id, db)).toEqual([]);
  });

  it("rejects a non-array payload without throwing", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(
      folder.id,
      "not-an-array" as unknown as never,
      db
    );

    expect(result).toMatchObject({ ok: false });
  });
});
