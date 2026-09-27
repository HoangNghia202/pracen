import { z } from "zod";

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required").max(100, "Folder name is too long"),
});
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
