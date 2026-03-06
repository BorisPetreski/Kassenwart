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

  refreshMembership: () => Promise<void>;

  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshMembership = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setOrgId(null);
      setRole(null);
      setIsOrgLoading(false);
      return;
    }

    setIsOrgLoading(true);

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
      setIsOrgLoading(false);
      return;
    }

    setOrgId(data?.org_id ?? null);
    setRole((data?.role as Role) ?? null);
    setIsOrgLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void refreshMembership();
  }, [refreshMembership]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      isLoading,
      orgId,
      role,
      isOrgLoading,
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
    };
  }, [session, isLoading, orgId, role, isOrgLoading, refreshMembership]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}