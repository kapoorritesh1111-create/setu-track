"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a changing value to reduce request spam from filter UIs.
 * Use for query params (dates, filters) that drive network calls.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
