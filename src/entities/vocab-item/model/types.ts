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
  example?: string;
  partOfSpeech?: string;
}
