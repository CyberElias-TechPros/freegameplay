import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import { q, siteUrl } from "@/lib/api";
import { GameCard } from "@/components/cards";
import { Reveal, SectionHead, EmptyState, Pagination } from "@/components/primitives";
import { AdUnit } from "@/components/ads";
import { JsonLd, siteLd } from "@/components/meta";
import { SortSelect } from "@/components/sort-select";

function SuspenseSort({ value }: { value: string }) {
  return (
    <Suspense fallback={null}>
      <SortSelect value={value} />
    </Suspense>
  );
}

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Games",
  description: "Every free browser game on FreeGameplay — playable in-browser, no downloads.",
  openGraph: { title: "Games · FreeGameplay", description: "Every free browser game on FreeGameplay." },
};

const PAGE_SIZE = 12;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const genre = params.genre ?? undefined;
  const search = params.q ?? undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const sort = params.sort ?? "newest";

  let data;
  try {
    data = await q.games({ genre, q: search, page: String(page), sort, pageSize: String(PAGE_SIZE) });
  } catch (e) {
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

  const genres = Array.from(new Set(data.items.map((g) => g.genre).filter(Boolean))) as string[];

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <JsonLd data={{ ...siteLd("FreeGameplay", siteUrl(), "Games directory"), item: "ItemList", itemListElement: data.items.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl()}/games/${g.slug}`, name: g.title })) }} />

      <AdUnit placement="list-top" />
      <SectionHead index="01 / Play" title={search ? `Results: “${search}”` : genre ? genre : "All games"} thin={`${data.total}`} />

      <Reveal>
        <div className="filter-bar" role="toolbar" aria-label="Filter games">
          <a
            className="filter-chip"
            href="/games"
            aria-pressed={!genre && !search}
          >
            All
          </a>
          {genres.map((g) => (
            <a key={g} className="filter-chip" href={`/games?genre=${encodeURIComponent(g)}`} aria-pressed={genre === g}>
              {g}
            </a>
          ))}
          <span className="filter-spacer" />
          <SuspenseSort value={sort} />
        </div>
      </Reveal>

      {data.items.length === 0 ? (
        <EmptyState
          code="NO_GAMES"
          title="No games match"
          note="Try clearing the filter, or search for something else."
          action={
            <a className="btn btn-ghost btn-sm" href="/games">
              Clear filters
            </a>
          }
        />
      ) : (
        <div className="game-grid">
          {data.items.map((g, i) => (
            <Reveal key={g.id} delay={Math.min(i, 6) * 0.04}>
              <GameCard game={g} index={i + 1 + (page - 1) * PAGE_SIZE} />
            </Reveal>
          ))}
        </div>
      )}

      {data.items.length > 3 ? <AdUnit placement="list-infeed-1" /> : null}

      <AdUnit placement="list-below" />
      <Pagination page={data.page} pages={data.pages} basePath="/games" query={{ ...(genre ? { genre } : {}), ...(search ? { q: search } : {}) }} />
    </div>
  );
}
