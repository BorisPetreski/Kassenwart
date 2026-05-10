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

type Strength = "weak" | "fair" | "strong";

function getStrength(pw: string): Strength {
  if (pw.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const score = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  if (score >= 3 && pw.length >= 10) return "strong";
  if (score >= 2) return "fair";
  return "weak";
}

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: "#F87171",
  fair: "#FCD34D",
  strong: "#34D399",
};
const STRENGTH_FILL: Record<Strength, number> = { weak: 1, fair: 2, strong: 3 };

function StrengthBar({ password, t }: { password: string; t: ReturnType<typeof useT>["t"] }) {
  if (!password) return null;
  const s = getStrength(password);
  const color = STRENGTH_COLOR[s];
  const fill = STRENGTH_FILL[s];
  const label = s === "weak" ? t.auth.passwordWeak : s === "fair" ? t.auth.passwordFair : t.auth.passwordStrong;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= fill ? color : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </View>
      <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  returnKeyType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: "next" | "done" | "go";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ position: "relative" }}>
      <Input
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder ?? "••••••••"}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType ?? "done"}
        style={{ paddingRight: 44 }}
        textContentType="newPassword"
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
        hitSlop={8}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={18} color="#5A6A8A" />
      </Pressable>
    </View>
  );
}

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

export default function ResetPasswordScreen() {
  const { updatePassword, clearPasswordReset } = useAuth();
  const { t } = useT();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }
    if (getStrength(password) === "weak") {
      setError(t.auth.passwordTooWeak);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.passwordsNoMatch);
      return;
    }

    setIsPending(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setIsPending(false);
    }
  };

  const goToApp = () => {
    clearPasswordReset();
    router.replace("/(tabs)/invoices");
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
              <Ionicons name="key-outline" size={26} color="#93C5FD" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.3 }}>
              {t.auth.newPassword}
            </Text>
            {!done && (
              <Text style={{ fontSize: 14, color: "#4A5672", textAlign: "center", paddingHorizontal: 8 }}>
                {t.auth.newPasswordSub}
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
                  <Ionicons name="shield-checkmark-outline" size={26} color="#6EE7B7" />
                </View>
                <Text style={{ color: "#EAF0FF", fontSize: 16, fontWeight: "800", textAlign: "center" }}>
                  {t.auth.passwordSaved}
                </Text>
                <Text style={{ color: "#7A8AAD", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                  {t.auth.passwordSavedBody}
                </Text>
                <Pressable
                  onPress={goToApp}
                  style={({ pressed }) => ({
                    backgroundColor: "#2E6BFF",
                    borderRadius: 12,
                    paddingVertical: 13,
                    width: "100%",
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.auth.goToApp}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {error ? <ErrorBanner message={error} /> : null}

                <Label>{t.auth.newPassword}</Label>
                <PasswordInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  placeholder={t.auth.minLength}
                  returnKeyType="next"
                />
                <StrengthBar password={password} t={t} />

                <Label>{t.auth.confirmPassword}</Label>
                <PasswordInput
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); setError(""); }}
                  placeholder={t.auth.confirmPasswordPlaceholder}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />

                {confirm.length > 0 && password !== confirm && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="close-circle-outline" size={14} color="#F87171" />
                    <Text style={{ color: "#F87171", fontSize: 12 }}>{t.auth.passwordsNoMatch}</Text>
                  </View>
                )}
                {confirm.length > 0 && password === confirm && password.length > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#34D399" />
                    <Text style={{ color: "#34D399", fontSize: 12 }}>{t.auth.passwordsMatch}</Text>
                  </View>
                )}

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
                    : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t.auth.savePassword}</Text>
                  }
                </Pressable>
              </>
            )}
          </Card>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
