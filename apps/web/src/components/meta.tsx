/** JSON-LD structured data for the document head. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line @next/next/no-duplicate-keys
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function articleLd(item: {
  title: string;
  url: string;
  image?: string | null;
  author?: { name: string; url?: string | null } | null;
  publishedAt: string;
  updatedAt?: string | null;
  description?: string | null;
  siteName: string;
}, type: "Article" | "HowTo" = "Article") {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    headline: item.title,
    url: item.url,
    datePublished: item.publishedAt,
    dateModified: item.updatedAt ?? item.publishedAt,
    name: item.title,
  };
  if (item.description) data.description = item.description;
  if (item.image) data.image = item.image;
  if (item.author) {
    data.author = { "@type": "Person", name: item.author.name, url: item.author.url ?? undefined };
  }
  data.publisher = { "@type": "Organization", name: item.siteName };
  return data;
}

export function gameLd(item: {
  title: string;
  url: string;
  image?: string | null;
  description?: string | null;
  genre?: string | null;
  siteName: string;
  playableRef?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: item.title,
    url: item.url,
    image: item.image ?? undefined,
    description: item.description ?? undefined,
    genre: item.genre ?? undefined,
    playMode: "SinglePlayer",
    gamePlatform: "Web Browser",
    applicationCategory: "Game",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(item.playableRef ? { sameAs: item.playableRef } : {}),
  };
}

export function siteLd(name: string, url: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    description,
  };
}
