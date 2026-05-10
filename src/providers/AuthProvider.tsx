import * as Linking from "expo-linking";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Role = "treasurer" | "member";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;

  orgId: string | null;
  role: Role | null;
  isOrgLoading: boolean;
  orgLoaded: boolean;

  pendingPasswordReset: boolean;
  clearPasswordReset: () => void;

  refreshMembership: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Parse access_token / refresh_token from a deep-link URL fragment.
// Supabase appends them as: kassenwart://#access_token=...&type=recovery
function extractTokensFromUrl(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const hash = url.includes("#") ? url.split("#")[1] : url.split("?")[1] ?? "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  } catch {}
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(false);
  const [orgLoaded, setOrgLoaded] = useState(false);

  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);

  const clearPasswordReset = useCallback(() => setPendingPasswordReset(false), []);

  // Handle a deep-link URL that may contain auth tokens (e.g. password-reset link).
  const handleAuthUrl = useCallback(async (url: string | null) => {
    if (!url) return;
    const tokens = extractTokensFromUrl(url);
    if (!tokens) return;
    await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── 1. Bootstrap: get the existing session ────────────────────────────────
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsLoading(false);
      if (!data.session) setOrgLoaded(true);
    });

    // ── 2. React to all subsequent auth state changes ─────────────────────────
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setPendingPasswordReset(true);
        // Don't refresh membership — the user needs to set a new password first.
        return;
      }

      if (event === "USER_UPDATED") {
        // Password was successfully changed; clear the reset gate.
        setPendingPasswordReset(false);
      }

      // For all other events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED …) do a
      // membership refresh so the gate always has fresh org/role data.
      void refreshMembership();
    });

    // ── 3. Deep-link handling (password-reset and email-confirm links) ─────────
    Linking.getInitialURL().then(handleAuthUrl);
    const linkSub = Linking.addEventListener("url", ({ url }) => void handleAuthUrl(url));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const refreshMembership = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    setIsOrgLoading(true);

    if (!userId) {
      setOrgId(null);
      setRole(null);
      setIsOrgLoading(false);
      setOrgLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("organization_memberships")
      .select("org_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setOrgId(null);
      setRole(null);
    } else {
      setOrgId(data?.org_id ?? null);
      setRole((data?.role as Role) ?? null);
    }

    setIsOrgLoading(false);
    setOrgLoaded(true);
  }, []);

  // Sync membership whenever the session user changes.
  useEffect(() => {
    if (session?.user?.id) void refreshMembership();
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      orgId,
      role,
      isOrgLoading,
      orgLoaded,
      pendingPasswordReset,
      clearPasswordReset,
      refreshMembership,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      resetPasswordForEmail: async (email) => {
        const redirectTo = Linking.createURL("reset-password");
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
      },
      updatePassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },
    }),
    [session, isLoading, orgId, role, isOrgLoading, orgLoaded, pendingPasswordReset, clearPasswordReset, refreshMembership]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
