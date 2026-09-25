import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { q, siteUrl, formatDate, formatHudDate, ApiError, isPost, ogImage } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { JsonLd, articleLd } from "@/components/meta";
import { PostRow } from "@/components/cards";

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

        <article className="article" style={{ marginTop: 48 }}>
          <div className="article-head">
            <p className="article-kicker">{post.categoryName ?? "blog"} · {formatHudDate(post.publishedAt)}</p>
            <h1 className="article-title">{post.title}</h1>
            {post.excerpt ? <p className="article-sub">{post.excerpt}</p> : null}
            <div className="article-byline">
              <b>{post.authorName ?? "FreeGameplay"}</b>
              <span className="dot" aria-hidden />
              <span>{formatDate(post.publishedAt)}</span>
              <span className="dot" aria-hidden />
              <span>{post.readingMinutes} min read</span>
            </div>
          </div>

          {post.featuredImageUrl ? (
            <Reveal>
              <div className="article-cover">
                <img src={ogImage(post.featuredImageUrl) ?? url} alt={post.title} />
              </div>
            </Reveal>
          ) : null}

          <Reveal>
            <div className="prose" dangerouslySetInnerHTML={{ __html: post.contentHtml ?? "" }} />
          </Reveal>

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
      </div>
    </>
  );
}
