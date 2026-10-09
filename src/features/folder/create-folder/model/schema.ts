import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required").max(100, "Folder name is too long"),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
