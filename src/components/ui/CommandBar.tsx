"use client";

import { ReactNode } from "react";

type Props = {
  /** Optional saved-views control (scaffolding). */
  views?: ReactNode;
  left: ReactNode;
  right?: ReactNode;
  message?: ReactNode;
  /** When true, uses a subtle sticky treatment on desktop list pages. */
  sticky?: boolean;
};

/**
 * CommandBar
 *
 * Deel-style “command surface” used under the page header.
 *
 * - Left: search + filters
 * - Right: secondary actions (export, refresh, bulk) — primary CTA lives in AppShell `right`
 * - Optional message row for context/empty-state tips
 */
export function CommandBar({ views, left, right, message, sticky }: Props) {
  return (
    <div className={`tsCommandBar card cardPad ${sticky ? "tsCommandBarSticky" : ""}`.trim()}>
      <div className="tsCommandBarRow">
        <div className="tsCommandBarLeft">
          <div className="tsCommandBarLeftInner">
            {views ? <div className="tsCommandBarViews">{views}</div> : null}
            <div className="tsCommandBarMain">{left}</div>
          </div>
        </div>
        {right ? <div className="tsCommandBarRight">{right}</div> : null}
      </div>
      {message ? <div className="tsCommandBarMsg">{message}</div> : null}
    </div>
  );
}
