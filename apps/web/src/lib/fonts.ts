import localFont from "next/font/local";

export const anton = localFont({
  src: "../../fonts/anton-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-display",
});

export const grotesk = localFont({
  src: [
    { path: "../../fonts/space-grotesk-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-body",
});

export const mono = localFont({
  src: [
    { path: "../../fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
});
