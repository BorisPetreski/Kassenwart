import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/providers/AuthProvider";
import { ui } from "../src/ui/atoms";
import { StatusBar } from "expo-status-bar";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading, orgId, isOrgLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  const loading = isLoading || isOrgLoading;

  useEffect(() => {
    if (loading) return;

    const first = String(segments?.[0] ?? "");
    const inAuth = first === "(auth)";
    const inOnboarding = first === "(onboarding)";

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
  }, [loading, session, orgId, segments, router]);

  if (loading) {
    return (
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}