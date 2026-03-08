export default function NotFound() {
  return (
    <main className="setuErrorPage">
      <div className="card cardPad" style={{ maxWidth: 640 }}>
        <div className="setuLoginMiniBadge">SETU TRACK</div>
        <h1>Page not found</h1>
        <p className="muted">The route you requested does not exist or has moved.</p>
        <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <a className="btnPrimary" href="/dashboard">Go to dashboard</a>
          <a className="pill" href="/login">Sign in</a>
        </div>
      </div>
    </main>
  );
}
