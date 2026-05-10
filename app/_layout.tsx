import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { AuthProvider, useAuth } from "../src/providers/AuthProvider";
import { ui } from "../src/ui/atoms";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading, orgId, isOrgLoading, orgLoaded, pendingPasswordReset } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  const loading = isLoading || isOrgLoading || !orgLoaded;

  useEffect(() => {
    if (loading) return;

    const first = String(segments?.[0] ?? "");
    const inAuth = first === "(auth)";
    const inOnboarding = first === "(onboarding)";
    const inResetPassword = segments.includes("reset-password");

    // Always allow the reset-password screen while a password reset is pending.
    if (pendingPasswordReset) {
      if (!inResetPassword) router.replace("/(auth)/reset-password");
      return;
    }

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    if (session && !orgId && !inOnboarding) {
      router.replace("/(onboarding)");
      return;
    }

    if (session && orgId && (inAuth || inOnboarding)) {
      router.replace("/(tabs)/invoices");
      return;
    }
  }, [loading, session, orgId, segments, router, pendingPasswordReset]);

  if (loading) {
    return (
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color="#4D8AFF" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <LanguageProvider>
        <AuthProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
