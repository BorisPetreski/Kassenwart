import React, { useState } from "react";
import { Alert, View } from "react-native";
import { Btn, Card, H1, Input, Label, P, ui } from "../../src/ui/atoms";
import { useAuth } from "../../src/providers/AuthProvider";

export default function LoginScreen() {
  const { signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    try {
      if (!email.trim() || !password) return Alert.alert("Fehlt", "Bitte E-Mail und Passwort eingeben.");
      if (mode === "login") await signInWithPassword(email.trim(), password);
      else {
        await signUp(email.trim(), password);
        Alert.alert("Account erstellt", "Wenn Email-Confirm aktiv ist, bitte bestätigen. Sonst kannst du direkt einloggen.");
      }
    } catch (e: any) {
      Alert.alert("Fehler", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>
        <H1>Kassenwart</H1>
        <P dim>Login oder Sign up.</P>

        <Card>
          <Label>E-Mail</Label>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Label>Passwort</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry />

          <Btn title={mode === "login" ? "Login" : "Sign up"} onPress={submit} />
          <Btn
            variant="secondary"
            title={mode === "login" ? "Zu Sign up wechseln" : "Zu Login wechseln"}
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
          />
        </Card>
      </View>
    </View>
  );
}