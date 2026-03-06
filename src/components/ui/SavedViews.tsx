"use client";

import { useEffect, useMemo, useState } from "react";

type ViewDef = {
  id: string;
  label: string;
  /** Arbitrary payload; typically an object of filters/search/sort. */
  state: any;
};

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * SavedViews (Phase 1.9 scaffolding)
 *
 * Local-first “Saved views” control to make list pages feel SaaS-grade.
 *
 * - Stores in localStorage (per browser) for now.
 * - You provide `getState()` and `applyState()` so pages opt-in without refactors.
 */
export default function SavedViews(props: {
  storageKey: string;
  getState: () => any;
  applyState: (state: any) => void;
  defaultViews?: Array<{ id: string; label: string; state: any }>;
}) {
  const key = `ts_views:${props.storageKey}`;

  const defaults = useMemo<ViewDef[]>(
    () => (props.defaultViews || []).map((v) => ({ id: v.id, label: v.label, state: v.state })),
    [props.defaultViews]
  );

  const [views, setViews] = useState<ViewDef[]>(defaults);
  const [selectedId, setSelectedId] = useState<string>(defaults[0]?.id || "");

  useEffect(() => {
    const saved = safeJsonParse<ViewDef[]>(localStorage.getItem(key));
    if (saved && Array.isArray(saved) && saved.length) {
      setViews(saved);
      setSelectedId(saved[0]?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: ViewDef[]) {
    setViews(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function onApply(id: string) {
    setSelectedId(id);
    const v = views.find((x) => x.id === id);
    if (v) props.applyState(v.state);
  }

  function onSave() {
    const label = prompt("Save current view as:");
    if (!label) return;
    const id = `${Date.now()}`;
    const next = [{ id, label, state: props.getState() }, ...views];
    persist(next);
    setSelectedId(id);
  }

  function onDelete() {
    const v = views.find((x) => x.id === selectedId);
    if (!v) return;
    const ok = confirm(`Delete saved view "${v.label}"?`);
    if (!ok) return;
    const next = views.filter((x) => x.id !== selectedId);
    persist(next);
    setSelectedId(next[0]?.id || "");
  }

  return (
    <div className="tsViews">
      <div className="tsViewsLabel">Views</div>
      <select className="tsViewsSelect" value={selectedId} onChange={(e) => onApply(e.target.value)}>
        {views.length ? null : <option value="">Default</option>}
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
      <button className="btn btnGhost tsViewsBtn" type="button" onClick={onSave}>
        Save
      </button>
      <button className="btn btnGhost tsViewsBtn" type="button" onClick={onDelete} disabled={!selectedId}>
        Delete
      </button>
    </div>
  );
}
