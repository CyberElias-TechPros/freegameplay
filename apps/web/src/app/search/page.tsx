import type { Metadata } from "next";
import Link from "next/link";
import { apiBase } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";
import type { SearchHit } from "@fg/shared";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Search",
  description: "Search every game, post and guide on FreeGameplay.",
};

const TYPE_LABEL: Record<string, string> = {
  games: "Games",
  posts: "Blog",
  guides: "Guides",
};

const TYPE_HREF: Record<string, string> = {
  games: "/games",
  posts: "/blog",
  guides: "/guides",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  let payload: { q: string; hits: SearchHit[]; tookMs: number } | null = null;
  if (query.length >= 2) {
    try {
      const res = await fetch(`${apiBase()}/api/search?q=${encodeURIComponent(query)}`, { next: { revalidate: 30 } });
      if (res.ok) payload = await res.json();
    } catch {
      payload = null;
    }
  }

  const grouped = payload
    ? payload.hits.reduce<Record<string, typeof payload.hits>>((acc, h) => {
        (acc[h.type] = acc[h.type] ?? []).push(h);
        return acc;
      }, {})
    : null;

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <SectionHead index="⌘K / Find" title="Search" thin={payload ? `${payload.hits.length} hits` : ""} />

      <Reveal>
        <p style={{ color: "var(--ink-2)", maxWidth: "60ch", marginBottom: 40 }}>
          Type <kbd style={{ fontFamily: "var(--font-mono)", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>⌘K</kbd>{" "}
          anywhere to open the instant search palette. Or use a full results page below.
        </p>
      </Reveal>

      {query.length < 2 ? (
        <EmptyState code="AWAITING_QUERY" title="What are you looking for?" note="Try “arcade”, “snake”, “breakout” or “guide”." />
      ) : !payload ? (
        <EmptyState code="NO_SIGNAL" title="Search is unavailable" note="The content API did not respond — start it and check API_BASE." />
      ) : payload.hits.length === 0 ? (
        <EmptyState code="NO_HITS" title={`No hits for “${query}”`} note="Try a shorter or broader term — search matches titles, excerpts and tags." />
      ) : (
        <div>
          {Object.entries(grouped ?? {}).map(([type, hits]) => (
            <section key={type} style={{ marginBottom: 48 }}>
              <p className="section-index" style={{ marginBottom: 8 }}>
                {TYPE_LABEL[type] ?? type} · {hits.length}
              </p>
              <div className="index-list">
                {hits.map((h, i) => (
                  <div className="index-row" key={`${h.type}-${h.id}`} style={{ gridTemplateColumns: "56px 1fr 110px" }}>
                    <span className="index-num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="index-main">
                      <h3>
                        <Link href={`/${TYPE_HREF[type]}/{h.slug}`}>{h.title}</Link>
                      </h3>
                      {h.excerpt ? <p>{h.excerpt}</p> : null}
                    </div>
                    <div className="index-side">
                      <span>
                        <b>open</b> →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
