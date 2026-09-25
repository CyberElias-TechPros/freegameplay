import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { q, siteUrl, ApiError } from "@/lib/api";
import { Breadcrumb, Reveal, SectionHead, EmptyState } from "@/components/primitives";
import { PostList } from "@/components/cards";
import { JsonLd } from "@/components/meta";

export const revalidate = 120;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { author } = await q.author(slug);
    const url = `${siteUrl()}/authors/${author.slug}`;
    return {
      title: author.name,
      description: author.bio ?? `Everything ${author.name} has written on FreeGameplay.`,
      alternates: { canonical: url },
      openGraph: { title: author.name, description: author.bio ?? undefined, type: "profile" },
    };
  } catch {
    return { title: "Author not found" };
  }
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  let data;
  try {
    data = await q.author(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { author, posts } = data;
  const url = `${siteUrl()}/authors/${author.slug}`;

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            name: author.name,
            url,
            ...(author.bio ? { description: author.bio } : {}),
          },
        }}
      />

      <div className="container">
        <Breadcrumb items={[{ label: "Authors", href: "/authors" }, { label: author.name, href: undefined }]} />

        <Reveal className="section-head" style={{ marginTop: 48 }}>
          <div>
            <p className="section-index">author</p>
            <h2
              className="section-title"
              style={{ textTransform: "none", fontSize: "clamp(2.4rem, 6vw, 5rem)" }}
            >
              {author.name}
            </h2>
            {author.bio ? (
              <p style={{ color: "var(--ink-2)", marginTop: 16, maxWidth: "60ch", lineHeight: 1.7 }}>{author.bio}</p>
            ) : null}
          </div>
        </Reveal>

        {posts.length === 0 ? (
          <EmptyState code="NO_POSTS" title="Nothing published yet" note="Posts from this author will show up here." />
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
