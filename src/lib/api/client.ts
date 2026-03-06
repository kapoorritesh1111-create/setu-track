import { supabase } from "../supabaseBrowser";

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

type ApiJsonInit = Omit<RequestInit, "body" | "headers"> & {
  /**
   * Convenience: allow passing a plain object for JSON bodies.
   * If you pass FormData/Blob/ArrayBuffer/etc it will be forwarded as-is.
   */
  body?: any;
  headers?: Record<string, string>;
};

function isBodyInit(v: any): v is BodyInit {
  if (v == null) return false;
  // FormData, URLSearchParams, Blob, ArrayBuffer, ReadableStream, etc.
  if (typeof v === "string") return true;
  if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return true;
  if (typeof Blob !== "undefined" && v instanceof Blob) return true;
  if (typeof FormData !== "undefined" && v instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && v instanceof URLSearchParams) return true;
  // ArrayBufferView
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView?.(v)) return true;
  return false;
}

export async function apiJson<T>(url: string, init?: ApiJsonInit): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    ...(init?.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  let body: BodyInit | undefined = undefined;

  if (init && "body" in init) {
    const b = (init as any).body;
    if (b == null) {
      body = undefined;
    } else if (isBodyInit(b)) {
      body = b;
    } else {
      // Assume plain object -> JSON
      body = JSON.stringify(b);
      if (!("Content-Type" in headers)) headers["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(url, {
    ...(init || {}),
    body,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
