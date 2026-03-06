import React, { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type MemberRow = { id: string; name: string; active: boolean };
type LedgerRow = { id: string; amount_signed: any; text: string | null; created_at: string; member?: { name: string } | null };

function toNum(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

async function fetchMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase.from("members").select("id,name,active").eq("active", true).order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchLedger(): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id,amount_signed,text,created_at,member:members(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any;
}

export default function LedgerScreen() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isTreasurer = role === "treasurer";

  const membersQ = useQuery({ queryKey: ["members_active"], queryFn: fetchMembers, enabled: isTreasurer });
  const ledgerQ = useQuery({ queryKey: ["ledger"], queryFn: fetchLedger, enabled: isTreasurer });

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error("Bitte Mitglied wählen.");
      const a = toNum(amount.replace(",", "."));
      if (!Number.isFinite(a) || a === 0) throw new Error("Betrag ungültig.");

      const { error } = await supabase.from("ledger_entries").insert({
        member_id: memberId,
        amount_signed: a,
        text: text.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setAmount("");
      setText("");
      await qc.invalidateQueries({ queryKey: ["ledger"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
      Alert.alert("OK", "Buchung gespeichert.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ledger_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ledger"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  const quick = (dir: "member_owes" | "cashbox_owes") => {
    const a = Math.abs(toNum(amount.replace(",", ".")));
    if (!a) return Alert.alert("Fehlt", "Erst Betrag eingeben.");
    // Sign convention:
    // negative -> member owes cashbox
    // positive -> cashbox owes member
    setAmount(String(dir === "member_owes" ? -a : a));
  };

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <H1>Buchungen</H1>
          <Card>
            <P>Nur der Kassenwart kann Buchungen erfassen.</P>
          </Card>
        </View>
      </View>
    );
  }

  const ledger = ledgerQ.data ?? [];
  const members = membersQ.data ?? [];

  return (
    <View style={ui.screen}>
      <FlatList
        data={ledger}
        keyExtractor={(x) => x.id}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 12 }}>
            <H1>Buchungen</H1>
            <P dim>Negativ = Mitglied schuldet der Kasse · Positiv = Kasse schuldet Mitglied</P>

            <Card>
              <H2>Neue Buchung</H2>

              <Label>Mitglied</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={memberId} onValueChange={(v) => setMemberId(String(v))}>
                  <Picker.Item label="Bitte auswählen…" value="" />
                  {members.map((m) => (
                    <Picker.Item key={m.id} label={m.name} value={m.id} />
                  ))}
                </Picker>
              </View>

              <Label>Betrag</Label>
              <Input value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="z.B. -10 oder +10" />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Btn variant="secondary" title="Mitglied schuldet (-)" onPress={() => quick("member_owes")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn variant="secondary" title="Kasse schuldet (+)" onPress={() => quick("cashbox_owes")} />
                </View>
              </View>

              <Label>Text (optional)</Label>
              <Input value={text} onChangeText={setText} placeholder="z.B. Bar-Ausgleich" />

              <Btn title={create.isPending ? "Speichere..." : "Speichern"} onPress={() => create.mutate()} disabled={create.isPending} />
            </Card>

            <H2>Letzte Buchungen</H2>
          </KeyboardAwareScrollView>
        }
        renderItem={({ item }) => (
          <Card>
            <H2>{item.member?.name ?? "Mitglied"}</H2>
            <P>{toNum(item.amount_signed).toFixed(2)} €</P>
            {item.text ? <P dim>{item.text}</P> : null}
            <P dim>{new Date(item.created_at).toLocaleString()}</P>

            <Btn
              variant="danger"
              title="Löschen"
              onPress={() => {
                Alert.alert("Buchung löschen?", "Diese Buchung wird entfernt.", [
                  { text: "Abbrechen", style: "cancel" },
                  { text: "OK", style: "destructive", onPress: () => del.mutate(item.id) },
                ]);
              }}
              disabled={del.isPending}
            />
          </Card>
        )}
      />
    </View>
  );
}