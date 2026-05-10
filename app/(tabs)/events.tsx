import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H2, Input, Label, P, SectionLabel, ui } from "../../src/ui/atoms";

type EventRow = { id: string; title: string; active: boolean; created_at: string };

async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function EventsScreen() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isTreasurer = role === "treasurer";

  const eventsQ = useQuery({ queryKey: ["events"], queryFn: fetchEvents, enabled: isTreasurer });
  const [title, setTitle] = useState("");

  const createEvent = useMutation({
    mutationFn: async () => {
      const tt = title.trim();
      if (!tt) throw new Error(t.events.titleRequired);
      const { error } = await supabase.from("events").insert({ title: tt, active: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      await qc.invalidateQueries({ queryKey: ["events"] });
      Alert.alert(t.common.ok, t.events.createSuccess);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const toggleEvent = useMutation({
    mutationFn: async (e: EventRow) => {
      const { error } = await supabase.from("events").update({ active: !e.active }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (e: EventRow) => {
      const { data: used, error: usedErr } = await supabase.from("invoices").select("id").eq("event_id", e.id).limit(1);
      if (usedErr) throw usedErr;
      const inUse = (used ?? []).length > 0;
      if (inUse) {
        const { error } = await supabase.from("events").update({ active: false }).eq("id", e.id);
        if (error) throw error;
        return { mode: "archived" as const };
      } else {
        const { error } = await supabase.from("events").delete().eq("id", e.id);
        if (error) throw error;
        return { mode: "deleted" as const };
      }
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["events"] });
      Alert.alert(t.common.ok, t.events.deleteSuccess(res.mode));
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <Card><P>{t.events.noAccess}</P></Card>
        </View>
      </View>
    );
  }

  const events = eventsQ.data ?? [];

  return (
    <View style={ui.screen}>
      <FlatList
        data={events}
        keyExtractor={(x) => x.id}
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 14 }} enableAutomaticScroll extraScrollHeight={20} keyboardShouldPersistTaps="handled">
            <Card>
              <H2>{t.events.createTitle}</H2>
              <Label>{t.events.titleLabel}</Label>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={t.events.titlePlaceholder}
                returnKeyType="done"
                onSubmitEditing={() => createEvent.mutate()}
              />
              <Btn
                title={createEvent.isPending ? t.events.creating : t.events.createBtn}
                onPress={() => createEvent.mutate()}
                disabled={createEvent.isPending}
              />
              <P dim>{t.events.hint}</P>
            </Card>

            <SectionLabel title={t.events.list} />
          </KeyboardAwareScrollView>
        }
        ListEmptyComponent={
          !eventsQ.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Ionicons name="calendar-outline" size={40} color="#2A3550" />
              <Text style={{ color: "#4A5672", fontSize: 14 }}>{t.events.noEvents}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <H2>{item.title}</H2>
              {!item.active ? (
                <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: "#7A8AAD", fontSize: 11, fontWeight: "700" }}>{t.events.archived}</Text>
                </View>
              ) : null}
            </View>
            <P dim>{t.events.createdAt(new Date(item.created_at).toLocaleString())}</P>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="secondary"
                  title={item.active ? t.events.archive : t.events.reactivate}
                  onPress={() => toggleEvent.mutate(item)}
                  disabled={toggleEvent.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="danger"
                  title={t.events.deleteBtn}
                  onPress={() => {
                    Alert.alert(t.events.deleteTitle, t.events.deleteBody, [
                      { text: t.common.cancel, style: "cancel" },
                      { text: t.common.ok, style: "destructive", onPress: () => deleteEvent.mutate(item) },
                    ]);
                  }}
                  disabled={deleteEvent.isPending}
                />
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
