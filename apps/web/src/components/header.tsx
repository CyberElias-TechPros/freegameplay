"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/games", label: "Games" },
  { href: "/blog", label: "Blog" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className={`header${scrolled || open ? " scrolled" : ""}`}>
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="FreeGameplay — home">
            <span className="brand-dot" aria-hidden />
            <span>
              Free<em>Game</em>play
            </span>
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  {n.label}
                </Link>
              );
            })}
            <Link href="/contact" className={pathname?.startsWith("/contact") ? "active" : undefined}>
              Contact
            </Link>
          </nav>

          <div className="header-actions">
            <button className="search-trigger" onClick={() => window.dispatchEvent(new CustomEvent("fg:open-search"))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span className="label">Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="burger" aria-expanded={open} aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="mobile-menu"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {NAV.map((n, i) => (
              <motion.a
                key={n.href}
                href={n.href}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {n.label}
              </motion.a>
            ))}
            <motion.a
              href="/contact"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              Contact
            </motion.a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
