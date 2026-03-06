import React from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, P, ui } from "../../src/ui/atoms";

export default function OnboardingIndex() {
  const router = useRouter();
  const { refreshMembership } = useAuth();

  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>
        <H1>Onboarding</H1>
        <P dim>
          Treasurer: Organisation erstellen. Mitglied: Du brauchst eine Einladung per E-Mail und musst dich mit dieser E-Mail registrieren.
        </P>

        <Card>
          <Btn title="Organisation erstellen (Treasurer)" onPress={() => router.push("/(onboarding)/create-org")} />

          <Btn
  variant="secondary"
  title="Ich wurde eingeladen – jetzt beitreten"
  onPress={async () => {
    try {
      const { error } = await supabase.rpc("accept_my_invite");
      if (error) throw error;

      await refreshMembership();
      Alert.alert("OK", "Du bist der Organisation beigetreten.");
    } catch (e: any) {
      Alert.alert("Fehler", e?.message ?? "Konnte nicht beitreten.");
    }
  }}
/>

          {/* ✅ Back to login */}
          <Btn
            variant="secondary"
            title="Zurück zum Login"
            onPress={async () => {
              // optional: fully sign out so you can switch account cleanly
              await supabase.auth.signOut();
              router.replace("/(auth)/login");
            }}
          />
        </Card>
      </View>
    </View>
  );
}