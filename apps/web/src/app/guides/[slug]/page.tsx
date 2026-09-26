import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { q, siteUrl, formatDate, formatHudDate, ApiError, isGuide } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { JsonLd, articleLd } from "@/components/meta";
import { AdUnit } from "@/components/ads";
import { Comments } from "@/components/comments";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { item } = await q.guide(slug);
    return {
      title: item.title,
      description: item.excerpt ?? item.title,
      alternates: { canonical: `${siteUrl()}/guides/${item.slug}` },
    };
  } catch {
    return { title: "Guide not found" };
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  let payload;
  try {
    payload = await q.guide(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { item: guide, related } = payload;
  const relatedGuides = related.filter(isGuide);
  const url = `${siteUrl()}/guides/${guide.slug}`;

  return (
    <>
      <JsonLd
        data={articleLd(
          {
            title: guide.title,
            url,
            author: guide.authorName ? { name: guide.authorName } : null,
            publishedAt: guide.publishedAt ?? "",
            updatedAt: guide.updatedAt,
            description: guide.excerpt,
            siteName: "FreeGameplay",
          },
          "HowTo",
        )}
      />

      <div className="container">
        <Breadcrumb
          items={[
            { label: "Guides", href: "/guides" },
            { label: guide.title, href: undefined },
          ]}
        />

        <div className="article-rail-grid">
        <article className="article" style={{ marginTop: 0 }}>
          <div className="article-head">
            <p className="article-kicker">
              {guide.gameSlug ? `guide · ${guide.gameTitle ?? guide.gameSlug}` : "guide"} · {formatHudDate(guide.publishedAt)}
            </p>
            <h1 className="article-title">{guide.title}</h1>
            {guide.excerpt ? <p className="article-sub">{guide.excerpt}</p> : null}
            <div className="article-byline">
              <b>
                {guide.authorSlug ? (
                  <a href={`/authors/${guide.authorSlug}`}>{guide.authorName ?? "FreeGameplay"}</a>
                ) : (
                  (guide.authorName ?? "FreeGameplay")
                )}
              </b>
              <span className="dot" aria-hidden />
              <span>{formatDate(guide.publishedAt)}</span>
              <span className="dot" aria-hidden />
              <span>{guide.readingMinutes} min read</span>
            </div>
            {guide.tags && guide.tags.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                {guide.tags.map((t) => (
                  <a key={t.id} href={`/tags/${t.slug}`} className="chip">
                    #{t.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {guide.gameSlug ? (
            <Reveal>
              <Link href={`/games/${guide.gameSlug}`} className="btn btn-primary btn-sm" style={{ marginBottom: 32 }}>
                Open {guide.gameTitle ?? "the game"} <span aria-hidden>→</span>
              </Link>
            </Reveal>
          ) : null}

          <Reveal>
            <div className="prose" dangerouslySetInnerHTML={{ __html: guide.contentHtml ?? "" }} />
          </Reveal>

          <AdUnit placement="guide-below" />

          {relatedGuides.length > 0 ? (
            <div className="related-strip">
              <p className="section-index" style={{ marginBottom: 28 }}>
                More guides
              </p>
              <div className="index-list">
                {relatedGuides.map((g, i) => (
                  <div className="index-row" key={g.id}>
                    <span className="index-num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="index-main">
                      <h3>
                        <Link href={`/guides/${g.slug}`}>{g.title}</Link>
                      </h3>
                      {g.excerpt ? <p>{g.excerpt}</p> : null}
                    </div>
                    <div className="index-side">
                      <span>
                        <b>{g.gameTitle ?? "general"}</b>
                      </span>
                      <span>{formatDate(g.publishedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="article-rail" aria-label="Related reading">
          <AdUnit placement="guide-sidebar" />
          {relatedGuides.length > 0 ? (
            <div className="rail-keep">
              <span className="section-index">More guides</span>
              {relatedGuides.slice(0, 4).map((g) => (
                <Link key={g.id} className="rail-row" href={`/guides/${g.slug}`}>
                  {g.title}
                  <small>
                    {g.gameTitle ?? "general"} · {formatDate(g.publishedAt)}
                  </small>
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
        </div>

        <div className="container">
          <Comments targetType="guide" targetSlug={guide.slug} />
        </div>
      </div>
    </>
  );
}
