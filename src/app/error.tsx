"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="setuErrorPage">
          <div className="card cardPad" style={{ maxWidth: 640 }}>
            <div className="setuLoginMiniBadge">SETU TRACK</div>
            <h1>Something went wrong</h1>
            <p className="muted">
              The app hit an unexpected error. Refresh the workspace or retry this view.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btnPrimary" onClick={reset}>Try again</button>
              <a className="pill" href="/dashboard">Go to dashboard</a>
            </div>
            <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{error.message}</pre>
          </div>
        </main>
      </body>
    </html>
  );
}
