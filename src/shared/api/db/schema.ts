import { pgTable, text, timestamp, integer, primaryKey, boolean, jsonb } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const folders = pgTable("folder", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const vocabItems = pgTable("vocabItem", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  folderId: text("folderId")
    .notNull()
    .references(() => folders.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  example: text("example"),
  partOfSpeech: text("partOfSpeech"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const quizzes = pgTable("quiz", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  folderId: text("folderId")
    .notNull()
    .references(() => folders.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  questionTypes: text("questionTypes")
    .array()
    .notNull()
    .$type<("meaning" | "word" | "sentence")[]>(),
  vocabItemIds: text("vocabItemIds").array().notNull(),
  shuffleQuestions: boolean("shuffleQuestions").notNull().default(false),
  shuffleAnswers: boolean("shuffleAnswers").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const quizQuestions = pgTable("quizQuestion", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: text("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderIndex: integer("orderIndex").notNull(),
  questionType: text("questionType").notNull().$type<"meaning" | "word" | "sentence">(),
  // Plain reference, deliberately not an FK — see the plan header's note on
  // denormalization. Deleting the source vocab item must never cascade-delete
  // or block-delete a question that already used it.
  vocabItemId: text("vocabItemId").notNull(),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  choices: jsonb("choices").$type<{ id: string; word: string; meaning: string }[] | null>(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});
