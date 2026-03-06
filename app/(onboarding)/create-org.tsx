import React, { useState } from "react";
import { Alert, View } from "react-native";
import { Btn, Card, H1, Input, Label, P, ui } from "../../src/ui/atoms";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useRouter } from "expo-router";

export default function CreateOrgScreen() {
  const router = useRouter();
  const { refreshMembership } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    try {
      const n = name.trim();
      if (!n) return Alert.alert("Fehlt", "Bitte Organisationsnamen eingeben.");

      setBusy(true);
      const { data, error } = await supabase.rpc("create_organization", { p_name: n });
      if (error) throw error;

      await refreshMembership();
      router.replace("/(tabs)/invoices");
    } catch (e: any) {
      Alert.alert("Fehler", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>
        <H1>Organisation erstellen</H1>
        <P dim>Das legt dich als Kassenwart an und seedet die Labels (BAMPF, STUMPF, Bierkasse, Veranstaltungen).</P>

        <Card>
          <Label>Name</Label>
          <Input value={name} onChangeText={setName} placeholder="z.B. Bierkasse 2026" />
          <Btn title={busy ? "Erstelle..." : "Erstellen"} onPress={create} disabled={busy} />
        </Card>
      </View>
    </View>
  );
}