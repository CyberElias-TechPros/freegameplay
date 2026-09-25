import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="FreeGameplay — home">
              <span className="brand-dot" aria-hidden />
              <span>
                Free<em>Game</em>play
              </span>
            </Link>
            <p>Free browser games, guides and writing. No downloads, no walls — just play.</p>
          </div>

          <div className="footer-col">
            <h5>Play</h5>
            <Link href="/games">All games</Link>
            <Link href="/games?genre=arcade">Arcade</Link>
            <Link href="/games?genre=puzzle">Puzzle</Link>
            <Link href="/games?genre=action">Action</Link>
          </div>

          <div className="footer-col">
            <h5>Read</h5>
            <Link href="/blog">Blog</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/search">Search</Link>
          </div>

          <div className="footer-col">
            <h5>Site</h5>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy-policy">Privacy policy</Link>
            <a href="/feed.xml" target="_blank" rel="noopener">
              RSS feed
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} FreeGameplay</span>
          <span className="status">All systems operational</span>
          <span>Built for the browser</span>
        </div>
      </div>
    </footer>
  );
}
