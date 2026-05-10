import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Card, Input, Label, ui } from "../../src/ui/atoms";

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

export default function CreateOrgScreen() {
  const router = useRouter();
  const { refreshMembership } = useAuth();
  const { t } = useT();

  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setError("");
    const n = name.trim();
    if (!n) { setError(t.onboarding.orgNameRequired); return; }
    if (n.length < 2) { setError(t.onboarding.orgNameTooShort); return; }

    setIsPending(true);
    try {
      const { error: rpcError } = await supabase.rpc("create_organization", { p_name: n });
      if (rpcError) throw rpcError;
      await refreshMembership();
      router.replace("/(tabs)/invoices");
    } catch (e: any) {
      setError(e?.message ?? t.onboarding.createOrgError);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>

        <View style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: "rgba(46,107,255,0.12)",
            borderWidth: 1,
            borderColor: "rgba(46,107,255,0.28)",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name="shield-outline" size={26} color="#4D8AFF" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.3 }}>
            {t.onboarding.createOrg}
          </Text>
          <Text style={{ fontSize: 14, color: "#4A5672", textAlign: "center", paddingHorizontal: 8 }}>
            {t.onboarding.createOrgSub}
          </Text>
        </View>

        <Card>
          {error ? <ErrorBanner message={error} /> : null}

          <Label>{t.onboarding.orgName}</Label>
          <Input
            value={name}
            onChangeText={(v) => { setName(v); setError(""); }}
            placeholder={t.onboarding.orgNamePlaceholder}
            returnKeyType="go"
            onSubmitEditing={create}
            autoFocus
          />

          <Pressable
            onPress={create}
            disabled={isPending}
            style={({ pressed }) => ({
              borderRadius: 12,
              paddingVertical: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isPending ? "rgba(46,107,255,0.55)" : "#2E6BFF",
              minHeight: 44,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.onboarding.createOrgBtn}</Text>
            }
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={{ alignItems: "center", paddingVertical: 4 }}
            hitSlop={8}
          >
            <Text style={{ color: "#4A5672", fontSize: 13 }}>{t.common.back}</Text>
          </Pressable>
        </Card>

      </View>
    </View>
  );
}
