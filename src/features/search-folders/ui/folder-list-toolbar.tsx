"use client";

import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useFolderListParams } from "../model/use-folder-list-params";

export function FolderListToolbar() {
  const { search, setSearch, sort, setSort } = useFolderListParams();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Input
        placeholder="Search folders"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="sm:max-w-xs"
      />
      <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
        <SelectTrigger className="sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recently-edited">Recently edited</SelectItem>
          <SelectItem value="recently-created">Recently created</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
