import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { q, siteUrl, ApiError } from "@/lib/api";
import { Breadcrumb, Reveal, SectionHead, EmptyState } from "@/components/primitives";
import { PostList } from "@/components/cards";

export const revalidate = 120;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const { tag } = await q.tag(slug);
    return {
      title: `#${tag.name}`,
      description: `Every post tagged ${tag.name} on FreeGameplay.`,
      alternates: { canonical: `${siteUrl()}/tags/${tag.slug}` },
      openGraph: { title: `#${tag.name} · FreeGameplay` },
    };
  } catch {
    return { title: "Tag not found" };
  }
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  let data;
  try {
    data = await q.tag(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { tag, posts } = data;

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <div className="container">
        <Breadcrumb items={[{ label: "Tags", href: "/tags" }, { label: tag.name, href: undefined }]} />

        <Reveal className="section-head" style={{ marginTop: 48 }}>
          <div>
            <p className="section-index">tag</p>
            <h2 className="section-title" style={{ textTransform: "none", fontSize: "clamp(2.4rem, 6vw, 5rem)" }}>
              #{tag.name}
            </h2>
          </div>
        </Reveal>

        {posts.length === 0 ? (
          <EmptyState code="NO_POSTS" title="Nothing tagged yet" note="Posts carrying this tag will show up here." />
        ) : (
          <>
            <SectionHead index="writing" title="Posts" thin={`${posts.length}`} link="/blog" linkLabel="All posts" />
            <Reveal>
              <PostList posts={posts} />
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
}
