import { Fragment } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { q, siteUrl, formatDate, formatHudDate, ApiError, isPost, ogImage } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { JsonLd, articleLd } from "@/components/meta";
import { PostRow } from "@/components/cards";
import { AdUnit } from "@/components/ads";
import { Comments } from "@/components/comments";
import { splitProse } from "@/lib/split-prose";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { item } = await q.post(slug);
    const url = `${siteUrl()}/blog/${item.slug}`;
    return {
      title: item.title,
      description: item.excerpt ?? item.title,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        title: item.title,
        description: item.excerpt ?? undefined,
        publishedTime: item.publishedAt ?? undefined,
        modifiedTime: (item.updatedAt ?? item.publishedAt) ?? undefined,
        authors: item.authorName ? [item.authorName] : undefined,
        images: item.featuredImageUrl ? [{ url: ogImage(item.featuredImageUrl) ?? url, width: 1200, height: 630, alt: item.title }] : undefined,
      },
    };
  } catch {
    return { title: "Post not found" };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  let payload;
  try {
    payload = await q.post(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { item: post, related } = payload;
  const relatedPosts = related.filter(isPost);
  const url = `${siteUrl()}/blog/${post.slug}`;
  // In-article ads land at paragraph boundaries (~40% / ~75% of the content).
  const proseParts = splitProse(post.contentHtml ?? "", [0.4, 0.75]);

  return (
    <>
      <JsonLd
        data={articleLd({
          title: post.title,
          url,
          image: post.featuredImageUrl,
          author: post.authorName ? { name: post.authorName } : null,
          publishedAt: post.publishedAt ?? "",
          updatedAt: post.updatedAt,
          description: post.excerpt,
          siteName: "FreeGameplay",
        })}
      />

      <div className="container">
        <Breadcrumb
          items={[
            { label: "Blog", href: "/blog" },
            { label: post.title, href: undefined },
          ]}
        />

        <AdUnit placement="article-top" />

        <div className="article-rail-grid">
          <article className="article" style={{ marginTop: 0 }}>
            <div className="article-head">
              <p className="article-kicker">{post.categoryName ?? "blog"} · {formatHudDate(post.publishedAt)}</p>
              <h1 className="article-title">{post.title}</h1>
              {post.excerpt ? <p className="article-sub">{post.excerpt}</p> : null}
              <div className="article-byline">
                <b>
                  {post.authorSlug ? (
                    <a href={`/authors/${post.authorSlug}`}>{post.authorName ?? "FreeGameplay"}</a>
                  ) : (
                    (post.authorName ?? "FreeGameplay")
                  )}
                </b>
                <span className="dot" aria-hidden />
                <span>{formatDate(post.publishedAt)}</span>
                <span className="dot" aria-hidden />
                <span>{post.readingMinutes} min read</span>
              </div>
              {post.tags && post.tags.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                  {post.tags.map((t) => (
                    <a key={t.id} href={`/tags/${t.slug}`} className="chip">
                      #{t.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {post.featuredImageUrl ? (
              <Reveal>
                <div className="article-cover">
                  <img src={ogImage(post.featuredImageUrl) ?? url} alt={post.title} />
                </div>
              </Reveal>
            ) : null}

            {proseParts.map((part, i) => (
              <Fragment key={i}>
                <Reveal>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: part }} />
                </Reveal>
                {i === 0 && proseParts.length > 1 ? (
                  <AdUnit placement="article-inline-1" />
                ) : null}
                {i === 1 && proseParts.length > 2 ? (
                  <AdUnit placement="article-inline-2" />
                ) : null}
              </Fragment>
            ))}

            <AdUnit placement="article-below" />

            {relatedPosts.length > 0 ? (
              <div className="related-strip">
                <p className="section-index" style={{ marginBottom: 28 }}>
                  Keep reading
                </p>
                {relatedPosts.slice(0, 3).map((p, i) => (
                  <PostRow key={p.id} post={p} index={i} />
                ))}
              </div>
            ) : null}
          </article>

          <aside className="article-rail" aria-label="Related reading">
            <AdUnit placement="article-sidebar" />
            {relatedPosts.length > 0 ? (
              <div className="rail-keep">
                <span className="section-index">Keep reading</span>
                {relatedPosts.slice(0, 4).map((p) => (
                  <Link key={p.id} className="rail-row" href={`/blog/${p.slug}`}>
                    {p.title}
                    <small>{formatDate(p.publishedAt)} · {p.readingMinutes} min</small>
                  </Link>
                ))}
              </div>
            ) : null}
          </aside>
        </div>

        <div className="container">
          <Comments targetType="post" targetSlug={post.slug} />
        </div>
      </div>
    </>
  );
}
