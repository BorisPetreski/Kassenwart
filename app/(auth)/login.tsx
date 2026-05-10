import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useT } from "../../src/i18n/LanguageProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, Input, Label, ui } from "../../src/ui/atoms";

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

function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={{
      backgroundColor: "rgba(16,185,129,0.12)",
      borderWidth: 1,
      borderColor: "rgba(16,185,129,0.25)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    }}>
      <Ionicons name="checkmark-circle-outline" size={16} color="#6EE7B7" />
      <Text style={{ color: "#6EE7B7", fontSize: 13, flex: 1 }}>{message}</Text>
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
  returnKeyType?: TextInput["props"]["returnKeyType"];
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

export default function LoginScreen() {
  const { signInWithPassword, signUp } = useAuth();
  const { t } = useT();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [signupDone, setSignupDone] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const toLocalError = (msg: string): string => {
    const map = t.auth.errorTranslations;
    for (const [key, val] of Object.entries(map)) {
      if (msg.toLowerCase().includes(key.toLowerCase())) return val;
    }
    if (/invalid.*(login|credentials)/i.test(msg)) return map.invalid_credentials;
    if (/email.*not.*confirmed/i.test(msg)) return map.email_not_confirmed;
    if (/user.*already.*registered/i.test(msg)) return map.user_already_exists;
    if (/rate.*limit|too.*many.*request/i.test(msg)) return map.too_many_requests;
    return msg;
  };

  const validate = (): string | null => {
    const e = email.trim();
    if (!e) return t.auth.email + " fehlt.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return t.auth.errorTranslations.invalid_credentials;
    if (!password) return t.auth.password + " fehlt.";
    if (mode === "signup" && password.length < 6) return t.auth.passwordTooShort;
    return null;
  };

  const submit = async () => {
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsPending(true);
    try {
      if (mode === "login") {
        await signInWithPassword(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setSignupDone(true);
        setPassword("");
      }
    } catch (e: any) {
      setError(toLocalError(e?.message ?? ""));
    } finally {
      setIsPending(false);
    }
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    setSignupDone(false);
    setPassword("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={ui.screen}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.content}>

          <View style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              backgroundColor: "rgba(46,107,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(46,107,255,0.28)",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons name="wallet-outline" size={32} color="#4D8AFF" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.5 }}>
              Kassenwart
            </Text>
            <Text style={{ fontSize: 14, color: "#4A5672", textAlign: "center" }}>
              Vereinsfinanzen einfach verwalten
            </Text>
          </View>

          <Card>
            <View style={{ flexDirection: "row", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 3 }}>
              {(["login", "signup"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    backgroundColor: mode === m ? "rgba(46,107,255,0.22)" : "transparent",
                    paddingVertical: 9,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: mode === m ? "#93C5FD" : "#4A5672", fontWeight: "700", fontSize: 14 }}>
                    {m === "login" ? t.auth.signIn : t.auth.signUp}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? <ErrorBanner message={error} /> : null}
            {signupDone ? <SuccessBanner message={t.auth.signUpConfirmBody} /> : null}

            {!signupDone && (
              <>
                <Label>{t.auth.email}</Label>
                <Input
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(""); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="deine@email.de"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  textContentType="emailAddress"
                  autoComplete="email"
                />

                <Label>{t.auth.password}</Label>
                <PasswordInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  placeholder={t.auth.passwordPlaceholder}
                  onSubmitEditing={submit}
                  returnKeyType="go"
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
                    : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                        {mode === "login" ? t.auth.signIn : t.auth.signUp}
                      </Text>
                  }
                </Pressable>

                {mode === "login" && (
                  <Pressable
                    onPress={() => router.push("/(auth)/forgot-password")}
                    style={{ alignItems: "center", paddingVertical: 4 }}
                    hitSlop={8}
                  >
                    <Text style={{ color: "#4D8AFF", fontSize: 13, fontWeight: "600" }}>
                      {t.auth.forgotPassword}
                    </Text>
                  </Pressable>
                )}
              </>
            )}

            {signupDone && (
              <Btn variant="secondary" title={t.auth.backToLogin} onPress={() => switchMode("login")} />
            )}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
