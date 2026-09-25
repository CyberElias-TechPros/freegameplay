"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { clientSearch, resolveMedia, siteUrl } from "@/lib/api";
import type { SearchHit, SearchPayload } from "@fg/shared";

const TYPE_LABEL: Record<string, string> = {
  games: "Games",
  posts: "Blog",
  guides: "Guides",
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fg:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fg:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setPayload(null);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const runSearch = useCallback(async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setPayload(null);
      return;
    }
    setLoading(true);
    try {
      const res = await clientSearch(value);
      setPayload(res);
      setSelected(0);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const hits: SearchHit[] = payload?.hits ?? [];
  const grouped = hits.reduce<Record<string, SearchHit[]>>((acc, h) => {
    (acc[h.type] = acc[h.type] ?? []).push(h);
    return acc;
  }, {});

  const go = (hit: SearchHit) => {
    setOpen(false);
    window.location.href = hit.url;
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && hits[selected]) {
      go(hits[selected]);
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="palette-backdrop"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={reduce ? false : { y: -14, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { y: -10, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="palette-input-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                className="palette-input"
                placeholder="Search games, posts, guides…"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                onKeyDown={onInputKey}
                aria-label="Search query"
              />
              <span className="palette-hint">ESC</span>
            </div>

            <div className="palette-results">
              {query.trim().length < 2 ? (
                <p className="palette-empty">Type at least 2 characters</p>
              ) : loading ? (
                <p className="palette-loading">Scanning…</p>
              ) : hits.length === 0 ? (
                <p className="palette-empty">No hits for “{query}” — try “arcade” or “guide”</p>
              ) : (
                Object.entries(grouped).map(([type, items]) => (
                  <div key={type}>
                    <p className="palette-group-label">{TYPE_LABEL[type] ?? type}</p>
                    {items.map((hit) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <button key={hit.id} className={`palette-hit${idx === selected ? " selected" : ""}`} onClick={() => go(hit)} onMouseEnter={() => setSelected(idx)}>
                          {hit.coverUrl ? (
                            <img src={resolveMedia(hit.coverUrl) ?? undefined} alt="" />
                          ) : (
                            <span className="palette-hit-ph">{hit.type.slice(0, 3).toUpperCase()}</span>
                          )}
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <b>{hit.title}</b>
                            <span>{hit.excerpt ?? ""}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="palette-footer">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span style={{ marginLeft: "auto" }}>{hits.length > 0 ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : siteUrl().replace(/^https?:\/\//, "")}</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
