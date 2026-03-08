import type { DatePreset } from "./dateRanges";

const PRESETS: DatePreset[] = ["current_week", "last_week", "current_month", "last_month", "custom"];

export function coercePreset(value: string | null | undefined, fallback: DatePreset = "current_month"): DatePreset {
  return PRESETS.includes(value as DatePreset) ? (value as DatePreset) : fallback;
}

export function buildRangeQuery({
  preset,
  start,
  end,
}: {
  preset: DatePreset;
  start?: string | null;
  end?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("preset", preset);
  if (preset === "custom") {
    if (start) params.set("start", start);
    if (end) params.set("end", end);
  }
  return params.toString();
}
