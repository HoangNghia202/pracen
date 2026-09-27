export interface Folder {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderWithStats extends Folder {
  wordCount: number;
}

export type FolderSort = "recently-created" | "recently-edited";
