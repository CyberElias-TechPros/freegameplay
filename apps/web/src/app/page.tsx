import type { Metadata } from "next";
import Link from "next/link";
import { q, siteUrl, resolveMedia } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";
import { GameCard, GuideCard, PostList, Ticker } from "@/components/cards";
import { AdUnit } from "@/components/ads";
import { JsonLd, siteLd } from "@/components/meta";
import { SubscribeForm } from "@/components/subscribe-form";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "FreeGameplay — Free Browser Games, Guides & Writing",
  description:
    "Play free browser games right now — no downloads, no paywalls — plus in-depth guides and honest writing about the browser arcade.",
  alternates: { canonical: siteUrl() },
  openGraph: {
    title: "FreeGameplay — Free Browser Games, Guides & Writing",
    description: "Free browser games you can actually play right now. No downloads, no walls.",
    url: siteUrl(),
    type: "website",
  },
};

/** Words that scroll past in the hero ticker. */
function tickerItems(labels: string[]): { label: string; href: string }[] {
  return labels.slice(0, 10).map((label) => ({ label, href: "/games" }));
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

  const { site, stats, featuredGames, latestGames, latestPosts, latestGuides, categories, tags } = home;
  const hero = featuredGames[0] ?? latestGames[0] ?? null;
  const heroImage = resolveMedia(hero?.coverUrl ?? null);

  const hudStats = [
    { value: String(stats.games), label: "games" },
    { value: String(stats.playableNow), label: "playable now" },
    { value: String(stats.guides), label: "guides" },
    { value: String(stats.posts), label: "articles" },
  ];

  return (
    <>
      <JsonLd
        data={{
          ...siteLd(site.name, siteUrl(), site.description ?? "Free browser games, guides and writing."),
          potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl()}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        {heroImage ? (
          <div className="hero-bg" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" fetchPriority="high" />
          </div>
        ) : null}
        <div className="hero-scanline" aria-hidden />

        <div className="container hero-inner">
          <div>
            <p className="hero-kicker">{site.tagline ?? "Free to play, right now"}</p>
            <h1 className="hero-title">
              <span className="line">Free</span>
              <span className="line thin">Game</span>
              <span className="line volt">play</span>
            </h1>
            <p className="hero-sub">
              {site.description ??
                "A hand-curated arcade of free browser games with deep guides, reviews and writing. No downloads, no paywalls, no fluff."}
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/games">
                Play now <span aria-hidden>→</span>
              </Link>
              <Link className="btn btn-ghost" href="/guides">
                Read the guides
              </Link>
            </div>
            <div className="hero-hud">
              {hudStats.map((s) => (
                <div key={s.label}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {hero ? (
            <Reveal delay={0.15} className="hero-feature">
              <Link href={`/games/${hero.slug}`} aria-label={`Play ${hero.title}`}>
                <div className="hero-feature-frame">
                  <span className="hero-feature-tag">Featured · {hero.builtin?.engine ? "built-in" : "embed"}</span>
                  {heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroImage} alt={`${hero.title} cover art`} />
                  ) : (
                    <div style={{ aspectRatio: "16 / 10", background: "var(--surface-2)" }} aria-hidden />
                  )}
                  <div className="hero-feature-body">
                    <div>
                      <h3>{hero.title}</h3>
                      <p>{hero.genre ?? "game"}</p>
                    </div>
                    <span className="play-badge" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ) : null}
        </div>

        <div className="hero-scroll" aria-hidden>
          scroll
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────────────────── */}
      <Ticker items={tickerItems(tags.map((t) => t.name))} />

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div className="stats-strip">
        <div className="container stats-inner">
          {hudStats.map((s, i) => (
            <div className="stat" key={s.label}>
              <b>
                {s.value}
                {i === 1 ? <em>+</em> : null}
              </b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Featured games ───────────────────────────────────────────────── */}
      {featuredGames.length > 0 ? (
        <section className="section">
          <div className="container">
            <SectionHead index="01 / Play" title="Featured games" thin={`${featuredGames.length}`} link="/games" linkLabel="All games" />
            <div className="game-grid">
              {featuredGames.map((g, i) => (
                <Reveal key={g.id} delay={Math.min(i, 6) * 0.05}>
                  <GameCard game={g} index={i + 1} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Latest games ─────────────────────────────────────────────────── */}
      {latestGames.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <SectionHead index="02 / New" title="Just added" thin={`${latestGames.length}`} link="/games?sort=newest" linkLabel="Browse newest" />
            <div className="game-grid">
              {latestGames.map((g, i) => (
                <Reveal key={g.id} delay={Math.min(i, 6) * 0.05}>
                  <GameCard game={g} index={i + 1} />
                </Reveal>
              ))}
            </div>
            <div style={{ marginTop: 48 }}>
              <AdUnit placement="home-infeed" />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Latest writing ───────────────────────────────────────────────── */}
      {latestPosts.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <SectionHead index="03 / Read" title="From the blog" thin={`${latestPosts.length}`} link="/blog" linkLabel="All posts" />
            <Reveal>
              <PostList posts={latestPosts.slice(0, 5)} />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── Guides ───────────────────────────────────────────────────────── */}
      {latestGuides.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <SectionHead index="04 / Learn" title="Guides" thin={`${latestGuides.length}`} link="/guides" linkLabel="All guides" />
            <div className="guide-grid">
              {latestGuides.map((g, i) => (
                <Reveal key={g.id} delay={Math.min(i, 4) * 0.06}>
                  <div style={{ gridColumn: "span 4" }}>
                    <GuideCard guide={g} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Categories ───────────────────────────────────────────────────── */}
      {categories.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <SectionHead index="05 / Browse" title="Categories" thin={`${categories.length}`} link="/categories" linkLabel="All categories" />
            <Reveal>
              <div className="index-list">
                {categories.slice(0, 6).map((c, i) => (
                  <div className="index-row" key={c.id} style={{ gridTemplateColumns: "56px 1fr 120px" }}>
                    <span className="index-num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="index-main">
                      <h3>
                        <Link href={`/categories/${c.slug}`}>{c.name}</Link>
                      </h3>
                      {c.description ? <p>{c.description}</p> : null}
                    </div>
                    <div className="index-side">
                      <span>
                        <b>view</b> →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── Newsletter + CTA ─────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <Reveal>
              <p className="section-index" style={{ marginBottom: 16 }}>
                Stay in the loop
              </p>
              <h2>
                New games, <em>straight to you</em>
              </h2>
              <p>
                One email when something worth playing lands. No spam, no daily digest, unsubscribe in one click.
              </p>
              <SubscribeForm source="home-cta" />
            </Reveal>
          </div>
          <div style={{ marginTop: 48 }}>
            <AdUnit placement="home-below" />
          </div>
        </div>
      </section>
    </>
  );
}
