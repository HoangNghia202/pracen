import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createVocabItem } from "@/entities/vocab-item";
import { getFolderWordsAction } from "./get-folder-words.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("getFolderWordsAction", () => {
  it("returns the folder's words for its owner", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await getFolderWordsAction(folder.id, db);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.items.map((i) => i.word)).toEqual(["Dog"]);
  });

  it("rejects a folder the requester doesn't own", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await getFolderWordsAction(folder.id, db)).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);
    expect(await getFolderWordsAction("f1", db)).toMatchObject({ ok: false });
  });
});
