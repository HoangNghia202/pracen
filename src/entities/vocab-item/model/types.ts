export interface VocabItem {
  id: string;
  folderId: string;
  word: string;
  meaning: string;
  example: string | null;
  partOfSpeech: string | null;
  createdAt: Date;
}

export interface NewVocabItem {
  word: string;
  meaning: string;
  // `string | null` (not just `string | undefined`) so an update can
  // explicitly clear a previously-set value to NULL — `undefined` means
  // "leave unchanged" (see `updateVocabItem`'s `!== undefined` guards),
  // while `null` means "the caller wants this field empty".
  example?: string | null;
  partOfSpeech?: string | null;
}
