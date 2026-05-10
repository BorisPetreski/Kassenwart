import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useT } from "../../src/i18n/LanguageProvider";
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

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail } = useAuth();
  const { t } = useT();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError(t.auth.errorTranslations.invalid_credentials);
      return;
    }
    setIsPending(true);
    try {
      await resetPasswordForEmail(e);
      setDone(true);
    } catch {
      setDone(true);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
              <Ionicons name="mail-outline" size={26} color="#4D8AFF" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.3 }}>
              {t.auth.forgotPasswordTitle}
            </Text>
            {!done && (
              <Text style={{ fontSize: 14, color: "#4A5672", textAlign: "center", paddingHorizontal: 8 }}>
                {t.auth.forgotPasswordSub}
              </Text>
            )}
          </View>

          <Card>
            {done ? (
              <View style={{ gap: 16, alignItems: "center" }}>
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "rgba(16,185,129,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(16,185,129,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Ionicons name="checkmark-circle-outline" size={26} color="#6EE7B7" />
                </View>
                <Text style={{ color: "#EAF0FF", fontSize: 16, fontWeight: "800", textAlign: "center" }}>
                  {t.auth.linkSent}
                </Text>
                <Text style={{ color: "#7A8AAD", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                  {t.auth.linkSentBody}
                </Text>
                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => ({
                    backgroundColor: "#2E6BFF",
                    borderRadius: 12,
                    paddingVertical: 13,
                    width: "100%",
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.auth.backToLogin}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {error ? <ErrorBanner message={error} /> : null}

                <Label>{t.auth.email}</Label>
                <Input
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(""); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="deine@email.de"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  autoFocus
                />

                <Pressable
                  onPress={submit}
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
                    : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.auth.sendLink}</Text>
                  }
                </Pressable>

                <Pressable
                  onPress={() => router.back()}
                  style={{ alignItems: "center", paddingVertical: 4 }}
                  hitSlop={8}
                >
                  <Text style={{ color: "#4A5672", fontSize: 13 }}>{t.auth.backToLogin}</Text>
                </Pressable>
              </>
            )}
          </Card>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
