import type { Metadata } from "next";
import { q } from "@/lib/api";
import { PostList } from "@/components/cards";
import { Reveal, SectionHead, EmptyState, Pagination } from "@/components/primitives";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description: "Writing about browser games, the arcade, and rebuilding a classic site.",
  openGraph: { title: "Blog · FreeGameplay" },
};

const PAGE_SIZE = 8;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const category = params.category ?? undefined;

  let data;
  try {
    data = await q.posts({ page: String(page), limit: String(PAGE_SIZE), category });
  } catch {
    return (
      <div className="section" style={{ paddingTop: 160 }}>
        <div className="container">
          <EmptyState
            code="NO_SIGNAL"
            title="The content API is unreachable"
            note="Start the backend (npm run dev:api) and check API_BASE in apps/web/.env.local."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <SectionHead index="02 / Read" title={category ? category : "The blog"} thin={`${data.total}`} />
      {data.items.length === 0 ? (
        <EmptyState code="NO_POSTS" title="Nothing here yet" note="Posts land here as soon as they're published." />
      ) : (
        <Reveal>
          <PostList posts={data.items} />
        </Reveal>
      )}
      <Pagination page={data.page} pages={data.pages} basePath="/blog" query={category ? { category } : {}} />
    </div>
  );
}
