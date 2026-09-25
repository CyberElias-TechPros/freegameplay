import type { Metadata } from "next";
import { q } from "@/lib/api";
import { PostList } from "@/components/cards";
import { Reveal, SectionHead, EmptyState, Pagination } from "@/components/primitives";
import { AdUnit } from "@/components/ads";

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
    data = await q.posts({ page: String(page), pageSize: String(PAGE_SIZE), category });
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
      <AdUnit placement="list-top" />
      <SectionHead index="02 / Read" title={category ? category : "The blog"} thin={`${data.total}`} />
      {data.items.length === 0 ? (
        <EmptyState code="NO_POSTS" title="Nothing here yet" note="Posts land here as soon as they're published." />
      ) : (
        <Reveal>
          <PostList posts={data.items.slice(0, 3)} />
          {data.items.length > 3 ? (
            <AdUnit placement="list-infeed-1" className="ad-unit-infeed" />
          ) : null}
          <PostList posts={data.items.slice(3, 7)} />
          {data.items.length > 7 ? (
            <AdUnit placement="list-infeed-2" className="ad-unit-infeed" />
          ) : null}
          <PostList posts={data.items.slice(7)} />
        </Reveal>
      )}
      <AdUnit placement="list-below" />
      <Pagination page={data.page} pages={data.pages} basePath="/blog" query={category ? { category } : {}} />
    </div>
  );
}
