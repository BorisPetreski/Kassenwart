import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Card, ui } from "../../src/ui/atoms";

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={{
      backgroundColor: "rgba(239,68,68,0.12)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.25)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    }}>
      <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
      <Text style={{ color: "#FCA5A5", fontSize: 13, flex: 1 }}>{message}</Text>
    </View>
  );
}

type Option = "choose" | "joining";

export default function OnboardingIndex() {
  const router = useRouter();
  const { refreshMembership, signOut } = useAuth();
  const { t } = useT();

  const [view, setView] = useState<Option>("choose");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const acceptInvite = async () => {
    setError("");
    setIsJoining(true);
    try {
      const { error: rpcError } = await supabase.rpc("accept_my_invite");
      if (rpcError) throw rpcError;
      await refreshMembership();
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (/no.*invitation|not.*found|invitation.*expired/i.test(msg)) {
        setError(t.onboarding.noInviteError);
      } else {
        setError(msg || t.onboarding.joinError);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>

        <View style={{ alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundColor: "rgba(46,107,255,0.12)",
            borderWidth: 1,
            borderColor: "rgba(46,107,255,0.28)",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name="wallet-outline" size={30} color="#4D8AFF" />
          </View>
          <Text style={{ fontSize: 26, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.5 }}>
            {t.onboarding.welcome}
          </Text>
          <Text style={{ fontSize: 14, color: "#4A5672", textAlign: "center" }}>
            {t.onboarding.subtitle}
          </Text>
        </View>

        {view === "choose" && (
          <>
            <Pressable
              onPress={() => router.push("/(onboarding)/create-org")}
              style={({ pressed }) => ({
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(46,107,255,0.3)",
                backgroundColor: pressed ? "rgba(46,107,255,0.12)" : "rgba(46,107,255,0.07)",
                padding: 18,
                gap: 8,
                flexDirection: "row",
                alignItems: "center",
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(46,107,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name="shield-outline" size={22} color="#4D8AFF" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: "#EAF0FF", fontWeight: "800", fontSize: 15 }}>{t.onboarding.isTreasurer}</Text>
                <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{t.onboarding.isTreasurerSub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4A5672" />
            </Pressable>

            <Pressable
              onPress={() => { setView("joining"); setError(""); }}
              style={({ pressed }) => ({
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
                backgroundColor: pressed ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                padding: 18,
                gap: 8,
                flexDirection: "row",
                alignItems: "center",
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.07)",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name="people-outline" size={22} color="#7A8AAD" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: "#EAF0FF", fontWeight: "800", fontSize: 15 }}>{t.onboarding.isMember}</Text>
                <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{t.onboarding.isMemberSub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4A5672" />
            </Pressable>
          </>
        )}

        {view === "joining" && (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Ionicons name="mail-outline" size={20} color="#7A9FD4" />
              <Text style={{ color: "#EAF0FF", fontWeight: "800", fontSize: 15 }}>{t.onboarding.acceptInviteTitle}</Text>
            </View>

            <Text style={{ color: "#7A8AAD", fontSize: 14, lineHeight: 20 }}>
              {t.onboarding.acceptInviteBody}
            </Text>

            {error ? <ErrorBanner message={error} /> : null}

            <Pressable
              onPress={acceptInvite}
              disabled={isJoining}
              style={({ pressed }) => ({
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isJoining ? "rgba(46,107,255,0.55)" : "#2E6BFF",
                minHeight: 44,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {isJoining
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.onboarding.joinNow}</Text>
              }
            </Pressable>

            <Pressable
              onPress={() => { setView("choose"); setError(""); }}
              style={{ alignItems: "center", paddingVertical: 4 }}
              hitSlop={8}
            >
              <Text style={{ color: "#4A5672", fontSize: 13 }}>{t.common.back}</Text>
            </Pressable>
          </Card>
        )}

        <Pressable
          onPress={() => signOut()}
          style={{ alignItems: "center", paddingVertical: 8 }}
          hitSlop={8}
        >
          <Text style={{ color: "#4A5672", fontSize: 13 }}>{t.onboarding.signOut}</Text>
        </Pressable>

      </View>
    </View>
  );
}
