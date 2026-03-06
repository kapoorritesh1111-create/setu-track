/**
 * Small color helpers (client-safe).
 * Hex only to avoid dependency bloat.
 */

export function isHexColor(v: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(v);
}

function normHex(hex: string): string {
  const h = hex.startsWith("#") ? hex : `#${hex}`;
  return h.toLowerCase();
}

export function darkenHex(hex: string, amount: number): string {
  // amount: 0..1
  const h = normHex(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

  const rr = clamp(r * (1 - amount));
  const gg = clamp(g * (1 - amount));
  const bb = clamp(b * (1 - amount));

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}
