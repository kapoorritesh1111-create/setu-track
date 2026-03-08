// src/lib/useProfile.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseBrowser";

export type Profile = {
  id: string;
  org_id: string;
  full_name: string;
  role: "admin" | "manager" | "contractor";
  hourly_rate: number | null;
  is_active: boolean;
  manager_id: string | null;
  onboarding_completed_at: string | null;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  ui_prefs?: any; // jsonb
};

type UseProfileResult = {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useProfile(): UseProfileResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent overlapping hydrations (auth events can fire more than you expect)
  const hydratingRef = useRef(false);
  const mountedRef = useRef(false);

  async function fetchProfile(uid: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, org_id, full_name, role, hourly_rate, is_active, manager_id, onboarding_completed_at, phone, address, avatar_url, ui_prefs"
      )
      .eq("id", uid)
      .maybeSingle();

    if (error) throw error;
    setProfile((data as Profile) ?? null);
  }

  async function hydrate(opts?: { showLoading?: boolean }) {
    if (hydratingRef.current) return;
    hydratingRef.current = true;

    if (opts?.showLoading) setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const session = data?.session ?? null;
      const uid = session?.user?.id ?? null;

      setUserId(uid);

      if (!uid) {
        setProfile(null);
        return;
      }

      await fetchProfile(uid);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
      setUserId(null);
      setProfile(null);
    } finally {
      setLoading(false);
      hydratingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    // Initial hydrate: show loading skeleton
    hydrate({ showLoading: true });

    // Auth events: do NOT flip loading=true (prevents “stuck loading” / flicker loops)
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!mountedRef.current) return;

      // Only re-hydrate on meaningful auth events
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        hydrate({ showLoading: false });
      }
    });

    return () => {
      mountedRef.current = false;
      data?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    userId,
    profile,
    loading,
    error,
    refresh: async () => hydrate({ showLoading: false }),
  };
}
