"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = new URLSearchParams(params.toString());
      if (e.target.value === "newest") next.delete("sort");
      else next.set("sort", e.target.value);
      router.push(`/games?${next.toString()}`);
    },
    [params, router],
  );

  return (
    <select className="sort-select" value={value} onChange={onChange} aria-label="Sort games">
      <option value="newest">Newest</option>
      <option value="oldest">Oldest</option>
      <option value="title">Title A–Z</option>
    </select>
  );
}
