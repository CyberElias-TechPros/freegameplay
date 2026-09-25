import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-404">
      <div>
        <div className="code" aria-hidden>
          404
        </div>
        <h1>Signal lost</h1>
        <p>
          This page doesn&apos;t exist — the URL may be from the old site (those are redirected automatically), or the link was broken.
        </p>
        <div className="links">
          <Link href="/" className="btn btn-primary">
            Back home
          </Link>
          <Link href="/games" className="btn btn-ghost">
            Browse games
          </Link>
          <Link href="/search" className="btn btn-ghost">
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
