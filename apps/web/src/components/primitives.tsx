"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/** Intersection-observer reveal. Framer Motion drives it; reduced motion
 *  and no-JS both degrade to plain visible content (CSS handles the rest). */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "article" | "li" | "span";
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const inner = (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y: 26, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
  if (Tag === "div") return inner;
  return (
    <Tag>
      {inner}
    </Tag>
  );
}

export function SectionHead({
  index,
  title,
  thin,
  link,
  linkLabel,
}: {
  index: string;
  title: string;
  thin?: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <Reveal className="section-head">
      <div>
        <p className="section-index">{index}</p>
        <h2 className="section-title">
          {title}
          {thin ? (
            <>
              {" "}
              <span className="thin">{thin}</span>
            </>
          ) : null}
        </h2>
      </div>
      {link ? (
        <a className="section-link" href={link}>
          {linkLabel ?? "View all"} <span aria-hidden>→</span>
        </a>
      ) : null}
    </Reveal>
  );
}

export function EmptyState({ code, title, note, action }: { code: string; title: string; note: string; action?: ReactNode }) {
  return (
    <div className="state" role="status">
      <span className="state-code">{code}</span>
      <h3>{title}</h3>
      <p>{note}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Pagination({ page, pages, basePath, query }: { page: number; pages: number; basePath: string; query?: Record<string, string> }) {
  if (pages <= 1) return null;
  const make = (p: number) => {
    const params = new URLSearchParams(query ?? {});
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav className="pagination" aria-label="Pagination">
      <a
        href={make(page - 1)}
        aria-disabled={page <= 1}
        style={page <= 1 ? { opacity: 0.35, pointerEvents: "none" } : undefined}
      >
        ← Prev
      </a>
      <span className="page-indicator">
        {String(page).padStart(2, "0")} / {String(pages).padStart(2, "0")}
      </span>
      <a
        href={make(page + 1)}
        aria-disabled={page >= pages}
        style={page >= pages ? { opacity: 0.35, pointerEvents: "none" } : undefined}
      >
        Next →
      </a>
    </nav>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span className="sep" aria-hidden>
            /
          </span>
          {it.href ? (
            <a href={it.href}>{it.label}</a>
          ) : (
            <span className="current">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
