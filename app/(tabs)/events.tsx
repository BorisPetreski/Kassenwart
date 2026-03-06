import React, { useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

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
  const isTreasurer = role === "treasurer";

  const eventsQ = useQuery({ queryKey: ["events"], queryFn: fetchEvents, enabled: isTreasurer });

  const [title, setTitle] = useState("");

  const createEvent = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      if (!t) throw new Error("Titel fehlt.");
      const { error } = await supabase.from("events").insert({ title: t, active: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      await qc.invalidateQueries({ queryKey: ["events"] });
      Alert.alert("OK", "Event erstellt.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
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
      // if invoices exist -> archive (active=false), else delete
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
      Alert.alert("OK", res.mode === "deleted" ? "Event gelöscht." : "Event genutzt → archiviert.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <H1>Events</H1>
          <Card>
            <P>Nur der Kassenwart kann Events verwalten.</P>
          </Card>
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
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 12 }}>
            <H1>Veranstaltungen</H1>

            <Card>
              <H2>Neues Event</H2>
              <Label>Titel</Label>
              <Input value={title} onChangeText={setTitle} placeholder="z.B. Sommerfest 2026" />
              <Btn title={createEvent.isPending ? "Erstelle..." : "Erstellen"} onPress={() => createEvent.mutate()} disabled={createEvent.isPending} />
              <P dim>Dieses Dropdown erscheint automatisch bei Label „Veranstaltungen“.</P>
            </Card>

            <H2>Liste</H2>
          </KeyboardAwareScrollView>
        }
        renderItem={({ item }) => (
          <Card>
            <H2>{item.title} {!item.active ? "(archiviert)" : ""}</H2>
            <P dim>Erstellt: {new Date(item.created_at).toLocaleString()}</P>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="secondary"
                  title={item.active ? "Archivieren" : "Reaktivieren"}
                  onPress={() => toggleEvent.mutate(item)}
                  disabled={toggleEvent.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="danger"
                  title="Löschen"
                  onPress={() => {
                    Alert.alert("Event löschen?", "Wenn genutzt, wird es archiviert.", [
                      { text: "Abbrechen", style: "cancel" },
                      { text: "OK", style: "destructive", onPress: () => deleteEvent.mutate(item) },
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