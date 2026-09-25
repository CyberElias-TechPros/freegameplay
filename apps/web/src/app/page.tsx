import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { q, siteUrl } from "@/lib/api";
import { GameRail, PostList, GuideCard, Ticker } from "@/components/cards";
import { resolveMedia } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";
import { JsonLd, siteLd, articleLd } from "@/components/meta";
import { notFound } from "next/navigation";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const home = await q.home();
    return {
      title: home.site.name ?? "FreeGameplay",
      description: home.site.tagline ?? undefined,
      openGraph: {
        title: home.site.name ?? "FreeGameplay",
        description: home.site.tagline ?? "Free browser games, guides and writing.",
        images: [{ url: "/media/og-cover.jpg", width: 1200, height: 630, alt: "FreeGameplay" }],
      },
    };
  } catch {
    return { title: "FreeGameplay" };
  }
}

export default async function HomePage() {
  let home;
  try {
    home = await q.home();
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

  const featured = home.featuredGames[0];
  const tickerItems = [
    ...(home.featuredGames ?? []).slice(0, 4).map((g) => ({ label: g.title, href: `/games/${g.slug}` })),
    ...(home.latestPosts ?? []).slice(0, 3).map((p) => ({ label: p.title, href: `/blog/${p.slug}` })),
    ...(home.latestGuides ?? []).slice(0, 2).map((g) => ({ label: g.title, href: `/guides/${g.slug}` })),
  ];

  return (
    <>
      <JsonLd data={siteLd(home.site.name, siteUrl(), home.site.tagline ?? "")} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden>
          <img src="/media/hero-wide.jpg" alt="" fetchPriority="high" />
        </div>
        <div className="hero-scanline" aria-hidden />
        <div className="container hero-inner">
          <div>
            <p className="hero-kicker">Free browser games · guides · writing</p>
            <h1 className="hero-title">
              <span className="line">The browser</span>
              <span className="line thin">is the</span>
              <span className="line volt">arcade.</span>
            </h1>
            <p className="hero-sub">
              {home.site.tagline ?? "Free browser games you can play right now, in-depth guides, and honest writing — no downloads, no walls."}
            </p>
            <div className="hero-ctas">
              <Link href="/games" className="btn btn-primary">
                Play games <span aria-hidden>→</span>
              </Link>
              <Link href="/guides" className="btn btn-ghost">
                Read the guides
              </Link>
            </div>
            <div className="hero-hud" aria-label="Site statistics">
              <div>
                <b>{home.stats.games}</b>
                <span>Games</span>
              </div>
              <div>
                <b>{home.stats.posts}</b>
                <span>Posts</span>
              </div>
              <div>
                <b>{home.stats.guides}</b>
                <span>Guides</span>
              </div>
              <div>
                <b>{home.stats.playableNow}</b>
                <span>Playable here</span>
              </div>
            </div>
          </div>

          {featured ? (
            <Reveal delay={0.25} className="hero-feature">
              <div className="hero-feature-frame hud">
                <Link href={`/games/${featured.slug}`} aria-label={`Play ${featured.title}`}>
                  {featured.coverUrl ? (
                    <img src={resolveMedia(featured.coverUrl) as string} alt={`${featured.title} cover art`} fetchPriority="high" />
                  ) : (
                    <div
                      style={{
                        aspectRatio: "16/10",
                        background: "linear-gradient(135deg,#101729,#0b101d 60%,#0e1a12)",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-mono)",
                        color: "var(--ink-3)",
                        letterSpacing: "0.3em",
                        fontSize: 12,
                      }}
                    >
                      FGP
                    </div>
                  )}
                </Link>
                <span className="hero-feature-tag">Playable now</span>
                <div className="hero-feature-body">
                  <div>
                    <h3>{featured.title}</h3>
                    <p>{featured.genre ?? "arcade"} · {featured.tagline ?? "free to play"}</p>
                  </div>
                  <Link href={`/games/${featured.slug}`} className="btn btn-primary btn-sm">
                    Play <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
        <div className="hero-scroll" aria-hidden>
          Scroll
        </div>
      </section>

      <Ticker items={tickerItems} />

      {/* ── FEATURED GAMES RAIL ──────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <SectionHead index="01 / Play" title="Featured" thin="games" link="/games" linkLabel="All games" />
          <Reveal delay={0.1}>
            <GameRail games={home.featuredGames.slice(0, 6)} />
          </Reveal>
        </div>
      </section>

      {/* ── LATEST WRITING ───────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead index="02 / Read" title="Latest" thin="writing" link="/blog" linkLabel="All posts" />
          {home.latestPosts.length === 0 ? (
            <EmptyState code="NO_POSTS" title="Nothing published yet" note="Content lands here as soon as it's imported." />
          ) : (
            <Reveal delay={0.1}>
              <PostList posts={home.latestPosts.slice(0, 4)} />
            </Reveal>
          )}
        </div>
      </section>

      {/* ── GUIDES BENTO ─────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead index="03 / Learn" title="Guides" thin="that work" link="/guides" linkLabel="All guides" />
          <div className="guide-grid">
            {home.latestGuides.slice(0, 4).map((g, i) => (
              <Reveal key={g.id} delay={0.05 * i}>
                <GuideCard guide={g} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal>
            <div className="cta-band hud">
              <h2>
                {home.stats.games} games. <em>Zero downloads.</em>
              </h2>
              <p>
                Every game on this site runs in your browser — {home.stats.playableNow} of them built from scratch for the site, the rest
                curated from the open web. If it's free, we'd rather host it ourselves.
              </p>
              <Link href="/games" className="btn btn-primary">
                Start playing <span aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
