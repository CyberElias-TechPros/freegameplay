import type { Metadata, Viewport } from "next";
import { anton, grotesk, mono } from "@/lib/fonts";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Atmosphere } from "@/components/atmosphere";
import { SearchPalette } from "@/components/search-palette";
import { ConsentBanner } from "@/components/consent";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "FreeGameplay — Free Browser Games, Guides & Writing",
    template: "%s · FreeGameplay",
  },
  description:
    "Free browser games you can actually play right now, in-depth guides, and honest writing about the browser arcade. No downloads, no walls.",
  keywords: ["free browser games", "online games", "retro arcade", "game guides", "indie games"],
  openGraph: {
    type: "website",
    siteName: "FreeGameplay",
    title: "FreeGameplay — Free Browser Games, Guides & Writing",
    description: "Free browser games you can actually play right now, in-depth guides, and honest writing about the browser arcade.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FreeGameplay — Free Browser Games, Guides & Writing",
    description: "Free browser games you can actually play right now, in-depth guides, and honest writing about the browser arcade.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "FreeGameplay RSS feed" }],
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

// NOTE: no headers()/cookies() in the layout — that would force every route
// to render dynamically. Consent/geo resolution is fully client-side (the
// content API exposes the visitor's country via GET /api/geo).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        <Atmosphere />
        <Header />
        <main>{children}</main>
        <Footer />
        <ConsentBanner />
        <SearchPalette />
      </body>
    </html>
  );
}
