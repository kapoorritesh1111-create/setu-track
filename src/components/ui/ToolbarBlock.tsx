"use client";

import { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right?: ReactNode;
  message?: ReactNode;
};

/**
 * Shared list-page toolbar surface.
 * Use for consistent “Monday-like” alignment of search + filters + stats/actions.
 */
export default function ToolbarBlock({ left, right, message }: Props) {
  return (
    <div className="mwToolbar card cardPad" style={{ marginBottom: 12 }}>
      <div className="mwToolbarRow">
        <div className="mwToolbarLeft">{left}</div>
        {right ? <div className="mwToolbarRight">{right}</div> : null}
      </div>
      {message ? <div className="mwToolbarMsg">{message}</div> : null}
    </div>
  );
}
