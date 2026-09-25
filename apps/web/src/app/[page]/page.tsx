import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { q, siteUrl, ApiError } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { ContactForm } from "@/components/contact-form";

export const revalidate = 3600;

// Static pages live in the CMS (pages table). This route renders any of them.
const ALLOWED = ["about", "contact", "privacy-policy"];

export function generateStaticParams() {
  return ALLOWED.map((slug) => ({ slug }));
}

interface Props {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  if (!ALLOWED.includes(page)) return { title: "Not found" };
  try {
    const { item } = await q.page(page);
    return {
      title: item.title,
      description: item.seoDescription ?? undefined,
      alternates: { canonical: `${siteUrl()}/${item.slug}` },
    };
  } catch {
    return { title: "Page not found" };
  }
}

export default async function StaticPage({ params }: Props) {
  const { page } = await params;
  if (!ALLOWED.includes(page)) notFound();
  let payload;
  try {
    payload = await q.page(page);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { item } = payload;
  const isContact = page === "contact";

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <div className="container">
        <Breadcrumb items={[{ label: item.title, href: undefined }]} />
        <article className="article" style={{ marginTop: 48 }}>
          <div className="article-head">
            <p className="article-kicker">page</p>
            <h1 className="article-title">{item.title}</h1>
          </div>

          {isContact ? (
            <Reveal>
              <ContactForm />
            </Reveal>
          ) : (
            <Reveal>
              <div className="prose" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
            </Reveal>
          )}
        </article>
      </div>
    </div>
  );
}
