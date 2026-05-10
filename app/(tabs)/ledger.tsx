import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, Divider, H2, Input, Label, P, SectionLabel, ui } from "../../src/ui/atoms";

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

const PICKER_CONTAINER = {
  borderRadius: 12,
  overflow: "hidden" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(0,0,0,0.30)",
};

export default function LedgerScreen() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isTreasurer = role === "treasurer";

  const membersQ = useQuery({ queryKey: ["members_active"], queryFn: fetchMembers, enabled: isTreasurer });
  const ledgerQ = useQuery({ queryKey: ["ledger"], queryFn: fetchLedger, enabled: isTreasurer });

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error(t.ledger.memberRequired);
      const a = toNum(amount.replace(",", "."));
      if (!Number.isFinite(a) || a === 0) throw new Error(t.ledger.amountInvalid);
      const { error } = await supabase.from("ledger_entries").insert({
        member_id: memberId,
        amount_signed: a,
        text: text.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setAmount(""); setText("");
      await qc.invalidateQueries({ queryKey: ["ledger"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
      Alert.alert(t.ledger.saveSuccess, t.ledger.saveSuccessBody);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
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
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const quick = (dir: "member_owes" | "cashbox_owes") => {
    const a = Math.abs(toNum(amount.replace(",", ".")));
    if (!a) return Alert.alert(t.common.error, t.ledger.amountHint);
    setAmount(String(dir === "member_owes" ? -a : a));
  };

  const ledger = ledgerQ.data ?? [];
  const members = membersQ.data ?? [];

  const total = useMemo(() => ledger.reduce((s, x) => s + toNum(x.amount_signed), 0), [ledger]);

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <Card><P>{t.ledger.noAccess}</P></Card>
        </View>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={ledger}
        keyExtractor={(x) => x.id}
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 14 }} enableAutomaticScroll extraScrollHeight={20} keyboardShouldPersistTaps="handled">
            <Card>
              <H2>{t.ledger.newEntry}</H2>

              <Label>{t.ledger.member}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker
                  selectedValue={memberId}
                  onValueChange={(v) => setMemberId(String(v))}
                  style={{ color: "#EAF0FF" }}
                  dropdownIconColor="#EAF0FF"
                >
                  <Picker.Item label={t.common.pleaseSelect} value="" />
                  {members.map((m) => (
                    <Picker.Item key={m.id} label={m.name} value={m.id} />
                  ))}
                </Picker>
              </View>

              <Label>{t.ledger.amount}</Label>
              <Input value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={t.ledger.amountPlaceholder} />

              

              <P dim>{t.ledger.hint}</P>

              <Label>{t.ledger.noteLabel}</Label>
              <Input value={text} onChangeText={setText} placeholder={t.ledger.notePlaceholder} />

              <Btn
                title={create.isPending ? t.ledger.saving : t.ledger.save}
                onPress={() => create.mutate()}
                disabled={create.isPending}
              />
            </Card>

            {ledger.length > 0 ? (
              <SectionLabel title={t.ledger.latestEntries} meta={t.common.entries(ledger.length)} />
            ) : null}
          </KeyboardAwareScrollView>
        }
        ListEmptyComponent={
          !ledgerQ.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Ionicons name="book-outline" size={40} color="#2A3550" />
              <Text style={{ color: "#4A5672", fontSize: 14 }}>{t.ledger.noEntries}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const a = toNum(item.amount_signed);
          const isPositive = a > 0;
          const color = isPositive ? "#34D399" : "#F87171";

          return (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ gap: 2, flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#EAF0FF" }}>
                    {item.member?.name ?? t.common.unknown}
                  </Text>
                  {item.text ? (
                    <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{item.text}</Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color }}>
                  {a >= 0 ? "+" : ""}{a.toFixed(2)} €
                </Text>
              </View>
              <Divider />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#4A5672", fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </Text>
                <Btn
                  variant="danger"
                  title={t.ledger.deleteBtn}
                  onPress={() => {
                    Alert.alert(t.ledger.deleteTitle, t.ledger.deleteBody, [
                      { text: t.common.cancel, style: "cancel" },
                      { text: t.ledger.deleteBtn, style: "destructive", onPress: () => del.mutate(item.id) },
                    ]);
                  }}
                  disabled={del.isPending}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
