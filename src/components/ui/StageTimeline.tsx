"use client";

import { StatusChip } from "./StatusChip";

export type TimelineStep = {
  key: string;
  label: string;
  done: boolean;
};

export default function StageTimeline({
  steps,
  className = "",
}: {
  steps: TimelineStep[];
  className?: string;
}) {
  return (
    <div className={`tsTimeline ${className}`.trim()}>
      {steps.map((st, i) => (
        <div key={st.key} className="tsTimelineStep">
          <StatusChip state={st.done ? st.key : "neutral"} label={st.label} className={st.done ? "" : "muted"} />
          {i < steps.length - 1 ? <span className="tsTimelineSep" aria-hidden="true">→</span> : null}
        </div>
      ))}
    </div>
  );
}
