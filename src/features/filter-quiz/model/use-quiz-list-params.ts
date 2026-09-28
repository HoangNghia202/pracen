"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useQuizListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const folderId = searchParams.get("folderId") ?? "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setFolderId(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("folderId", next);
    else params.delete("folderId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return { search, setSearch, folderId, setFolderId };
}
