import { SaveGame } from "@/components/library";
import { sanitizeContent } from "@fg/shared/content-safety";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { q, siteUrl, formatDate, ApiError, isGame, ogImage } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { JsonLd, gameLd } from "@/components/meta";
import { GameCard } from "@/components/cards";
import { GameEngine, type BuiltinEngine } from "@/components/engines/GameEngine";
import { Leaderboard } from "@/components/leaderboard";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { item } = await q.game(slug);
    const url = `${siteUrl()}/games/${item.slug}`;
    return {
      title: item.title,
      alternates: { canonical: url },
      description: item.tagline ?? item.title,
      openGraph: {
        title: item.title,
        description: item.tagline ?? undefined,
        type: "website",
        images: item.coverUrl ? [{ url: ogImage(item.coverUrl) ?? url, width: 1200, height: 630, alt: item.title }] : undefined,
      },
    };
  } catch {
    return { title: "Game not found" };
  }
}

const ENGINE_BY_NAME: Record<string, BuiltinEngine> = {
  breakout: "breakout",
  dodge: "dodge",
  snake: "snake",
  gravity: "gravity",
};

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  let payload;
  try {
    payload = await q.game(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { item: game, related } = payload;
  const relatedGames = related.filter(isGame);
  const engine = game.builtin?.engine ? ENGINE_BY_NAME[game.builtin.engine] : undefined;
  const url = `${siteUrl()}/games/${game.slug}`;
  const isExternal = game.playableType === "external" && !engine && game.playableRef?.startsWith("https://");

  return (
    <>
      <JsonLd data={gameLd({ title: game.title, url, image: game.coverUrl, description: game.tagline, genre: game.genre, siteName: "FreeGameplay", playableRef: game.playableType === "builtin" ? url : null })} />

      <div className="container">
        <Breadcrumb
          items={[
            { label: "Games", href: "/games" },
            { label: game.title, href: undefined },
          ]}
        />

        <SaveGame slug={game.slug} title={game.title} />
        <div className="game-hero">
          {/* left: player */}
          <Reveal>
            {engine ? (
              <GameEngine engine={engine} gameSlug={game.slug} />
            ) : isExternal ? (
              <div className="player">
                <p>This game is hosted by another publisher. <a href={game.playableRef!} target="_blank" rel="noopener noreferrer">Open the publisher’s game</a></p>
                <div className="player-topbar">
                  <span className="live">External</span>
                  <span>{game.title}</span>
                  <span>Hosted by {new URL(game.playableRef as string).hostname}</span>
                </div>
                <div className="player-stage">
                  <p style={{ padding: 24 }}>External games open on their publisher’s website. Availability, pricing and privacy practices may differ. Embedded play is disabled until the provider is reviewed.</p>
                </div>
              </div>
            ) : (
              <div className="player">
                <div className="player-topbar">
                  <span>Unavailable</span>
                  <span>{game.title}</span>
                  <span>—</span>
                </div>
                <div className="player-stage">
                  <div className="player-overlay">
                    <div>
                      <h3>Not embeddable</h3>
                      <p>This game has no playable embed configured.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Reveal>

          {/* right: HUD panels */}
          <div className="hud-external">
            <Reveal delay={0.05}>
              <div className="hud-panel hud">
                <h4>Game file</h4>
                <div className="kv-row">
                  <span>Title</span>
                  <b>{game.title}</b>
                </div>
                <div className="kv-row">
                  <span>Genre</span>
                  <b>{game.genre ?? "—"}</b>
                </div>
                <div className="kv-row">
                  <span>Category</span>
                  <b>{game.categoryName ?? "—"}</b>
                </div>
                <div className="kv-row">
                  <span>Type</span>
                  <b className="volt">{engine ? "Built-in engine" : isExternal ? "External embed" : "No embed"}</b>
                </div>
                <div className="kv-row">
                  <span>Updated</span>
                  <b>{formatDate(game.updatedAt)}</b>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="hud-panel">
                <h4>Controls</h4>
                {game.controls ? (
                  <div className="controls-list" dangerouslySetInnerHTML={{ __html: sanitizeContent(game.controls) }} />
                ) : (
                  <ul className="controls-list">
                    <li>
                      <span>Move</span>
                      <kbd>← →</kbd>
                    </li>
                    <li>
                      <span>Pause</span>
                      <kbd>P</kbd>
                    </li>
                  </ul>
                )}
              </div>
            </Reveal>

            {game.leaderboardEnabled && engine ? (
              <Reveal delay={0.2}>
                <Leaderboard gameSlug={game.slug} />
              </Reveal>
            ) : null}

            {game.tags && game.tags.length > 0 ? (
              <Reveal delay={0.15}>
                <div className="hud-panel">
                  <h4>Tags</h4>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {game.tags.map((t) => (
                      <Link key={t.id} href={`/search?q=${encodeURIComponent(t.name)}`} className="chip">
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>

        {/* description + content */}
        <section className="section" style={{ paddingTop: "clamp(56px, 7vw, 96px)" }}>
          <div className="article">
            {game.tagline ? (
              <p className="article-sub" style={{ marginTop: 0 }}>
                {game.tagline}
              </p>
            ) : null}
            {game.description ? (
              <div className="prose" style={{ marginTop: 24 }} dangerouslySetInnerHTML={{ __html: sanitizeContent(game.description) }} />
            ) : null}

            {relatedGames.length > 0 ? (
              <div className="related-strip">
                <p className="section-index" style={{ marginBottom: 24 }}>
                  Play next
                </p>
                <div className="game-grid">
                  {relatedGames.slice(0, 3).map((g, i) => (
                    <Reveal key={g.id} delay={i * 0.05}>
                      <GameCard game={g} index={i + 1} />
                    </Reveal>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
