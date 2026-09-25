"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // keep the console honest in local dev
    console.error(error);
  }, [error]);

  return (
    <div className="page-404">
      <div>
        <div className="code" aria-hidden>
          500
        </div>
        <h1>Something broke on our side</h1>
        <p>
          The error has been logged{error.digest ? ` (ref ${error.digest})` : ""}. Try again — if it persists, the content API may need a restart.
        </p>
        <div className="links">
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
