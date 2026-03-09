"use client";

import Button from "./Button";

export default function ErrorState({
  message,
  onRetry,
  actionLabel = "Retry",
}: {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="alert alertError" role="alert">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>{message}</span>
        {onRetry ? <Button variant="ghost" onClick={onRetry}>{actionLabel}</Button> : null}
      </div>
    </div>
  );
}
