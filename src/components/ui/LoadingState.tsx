"use client";

export default function LoadingState({
  title = "Loading…",
  description,
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className={`card ${compact ? "" : "cardPad"}`.trim()}>
      <div className="setuLoadingState">
        <div className="setuLoadingPulse" aria-hidden="true" />
        <div>
          <div style={{ fontWeight: 900 }}>{title}</div>
          {description ? <div className="muted" style={{ marginTop: 4 }}>{description}</div> : null}
        </div>
      </div>
    </div>
  );
}
