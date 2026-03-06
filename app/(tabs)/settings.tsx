import React, { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type LabelRow = {
  id: string;
  name: string;
  type: "standard" | "event";
  recipient_name: string | null;
  recipient_email: string | null;
  active: boolean;
  created_at: string;
};

type SublabelRow = {
  id: string;
  label_id: string;
  name: string;
  active: boolean;
};

function normEmail(v: string) {
  return v.trim().toLowerCase();
}

async function fetchLabels(): Promise<LabelRow[]> {
  const { data, error } = await supabase
    .from("labels")
    .select("id,name,type,recipient_name,recipient_email,active,created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchSublabels(labelId: string | null): Promise<SublabelRow[]> {
  if (!labelId) return [];
  const { data, error } = await supabase
    .from("sublabels")
    .select("id,label_id,name,active")
    .eq("label_id", labelId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isTreasurer = role === "treasurer";

  const labelsQ = useQuery({ queryKey: ["labels_all"], queryFn: fetchLabels, enabled: isTreasurer });

  const labels = labelsQ.data ?? [];
  const activeLabels = useMemo(() => labels.filter((l) => l.active), [labels]);

  // create label
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"standard" | "event">("standard");
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmail, setNewRecEmail] = useState("");

  const createLabel = useMutation({
    mutationFn: async () => {
      const n = newName.trim();
      if (!n) throw new Error("Label-Name fehlt.");

      const email = newRecEmail.trim();
      if (email && !email.includes("@")) throw new Error("Empfänger E-Mail ungültig.");

      const { error } = await supabase.from("labels").insert({
        name: n,
        type: newType,
        recipient_name: newRecName.trim() || null,
        recipient_email: email ? normEmail(email) : null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewName("");
      setNewRecName("");
      setNewRecEmail("");
      setNewType("standard");
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
      Alert.alert("OK", "Label erstellt.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  // edit label
  const [editId, setEditId] = useState("");
  const editLabel = labels.find((l) => l.id === editId) ?? null;

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"standard" | "event">("standard");
  const [editRecName, setEditRecName] = useState("");
  const [editRecEmail, setEditRecEmail] = useState("");

  const startEdit = (l: LabelRow) => {
    setEditId(l.id);
    setEditName(l.name);
    setEditType(l.type);
    setEditRecName(l.recipient_name ?? "");
    setEditRecEmail(l.recipient_email ?? "");
  };

  const saveLabel = useMutation({
    mutationFn: async () => {
      if (!editId) throw new Error("Kein Label gewählt.");
      const n = editName.trim();
      if (!n) throw new Error("Label-Name fehlt.");

      const email = editRecEmail.trim();
      if (email && !email.includes("@")) throw new Error("Empfänger E-Mail ungültig.");

      const { error } = await supabase
        .from("labels")
        .update({
          name: n,
          type: editType,
          recipient_name: editRecName.trim() || null,
          recipient_email: email ? normEmail(email) : null,
        })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
      Alert.alert("OK", "Label gespeichert.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  const toggleLabel = useMutation({
    mutationFn: async (l: LabelRow) => {
      const { error } = await supabase.from("labels").update({ active: !l.active }).eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: async (l: LabelRow) => {
      const { data: used, error: usedErr } = await supabase
        .from("invoices")
        .select("id")
        .eq("label_id", l.id)
        .limit(1);
      if (usedErr) throw usedErr;

      const inUse = (used ?? []).length > 0;
      if (inUse) {
        const { error } = await supabase.from("labels").update({ active: false }).eq("id", l.id);
        if (error) throw error;
        return { mode: "archived" as const };
      } else {
        const { error } = await supabase.from("labels").delete().eq("id", l.id);
        if (error) throw error;
        return { mode: "deleted" as const };
      }
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
      Alert.alert("OK", res.mode === "deleted" ? "Label gelöscht." : "Label genutzt → archiviert (active=false).");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  // sublabels
  const [parentLabelId, setParentLabelId] = useState("");
  const sublabelsQ = useQuery({
    queryKey: ["sublabels", parentLabelId || "none"],
    queryFn: () => fetchSublabels(parentLabelId || null),
    enabled: isTreasurer,
  });

  const [newSubName, setNewSubName] = useState("");

  const createSublabel = useMutation({
    mutationFn: async () => {
      if (!parentLabelId) throw new Error("Bitte Label auswählen.");
      const n = newSubName.trim();
      if (!n) throw new Error("Sublabel-Name fehlt.");

      const { error } = await supabase.from("sublabels").insert({
        label_id: parentLabelId,
        name: n,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewSubName("");
      await qc.invalidateQueries({ queryKey: ["sublabels", parentLabelId || "none"] });
      Alert.alert("OK", "Sublabel erstellt.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  const toggleSublabel = useMutation({
    mutationFn: async (s: SublabelRow) => {
      const { error } = await supabase.from("sublabels").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sublabels", parentLabelId || "none"] });
    },
  });

  const deleteSublabel = useMutation({
    mutationFn: async (s: SublabelRow) => {
      const { data: used, error: usedErr } = await supabase
        .from("invoices")
        .select("id")
        .eq("sublabel_id", s.id)
        .limit(1);
      if (usedErr) throw usedErr;

      const inUse = (used ?? []).length > 0;
      if (inUse) {
        const { error } = await supabase.from("sublabels").update({ active: false }).eq("id", s.id);
        if (error) throw error;
        return { mode: "archived" as const };
      } else {
        const { error } = await supabase.from("sublabels").delete().eq("id", s.id);
        if (error) throw error;
        return { mode: "deleted" as const };
      }
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["sublabels", parentLabelId || "none"] });
      Alert.alert("OK", res.mode === "deleted" ? "Sublabel gelöscht." : "Sublabel genutzt → archiviert.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <H1>Labels</H1>
          <Card>
            <P>Nur der Kassenwart kann Labels/Sublabels verwalten.</P>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={labels}
        keyExtractor={(l) => l.id}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 12 }}>
            <H1>Labels & Sublabels</H1>

            <Card>
              <H2>Neues Label</H2>
              <Label>Name</Label>
              <Input value={newName} onChangeText={setNewName} placeholder="z.B. Renovierungstopf" />

              <Label>Typ</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={newType} onValueChange={(v) => setNewType(String(v) as any)}>
                  <Picker.Item label="Standard" value="standard" />
                  <Picker.Item label="Event (Veranstaltungen)" value="event" />
                </Picker>
              </View>

              <Label>Empfänger Name</Label>
              <Input value={newRecName} onChangeText={setNewRecName} placeholder="optional" />

              <Label>Empfänger Email</Label>
              <Input value={newRecEmail} onChangeText={setNewRecEmail} autoCapitalize="none" keyboardType="email-address" placeholder="optional" />

              <Btn title={createLabel.isPending ? "Erstelle..." : "Label erstellen"} onPress={() => createLabel.mutate()} disabled={createLabel.isPending} />
              <P dim>Hinweis: Für Monatsabrechnungen nutzt du recipient_email + Signed Links zu PDFs.</P>
            </Card>

            <Card>
              <H2>Label bearbeiten</H2>
              <P dim>Wähle ein Label über „Bearbeiten“ in der Liste.</P>

              <Label>Name</Label>
              <Input value={editName} onChangeText={setEditName} placeholder="Name" />

              <Label>Typ</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={editType} onValueChange={(v) => setEditType(String(v) as any)}>
                  <Picker.Item label="Standard" value="standard" />
                  <Picker.Item label="Event (Veranstaltungen)" value="event" />
                </Picker>
              </View>

              <Label>Empfänger Name</Label>
              <Input value={editRecName} onChangeText={setEditRecName} placeholder="optional" />

              <Label>Empfänger Email</Label>
              <Input value={editRecEmail} onChangeText={setEditRecEmail} autoCapitalize="none" keyboardType="email-address" placeholder="optional" />

              <Btn title={saveLabel.isPending ? "Speichere..." : "Speichern"} onPress={() => saveLabel.mutate()} disabled={!editId || saveLabel.isPending} />
              {editLabel ? <P dim>Aktuell: {editLabel.name}</P> : <P dim>Kein Label gewählt.</P>}
            </Card>

            <Card>
              <H2>Sublabels</H2>
              <Label>Für Label</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={parentLabelId} onValueChange={(v) => setParentLabelId(String(v))}>
                  <Picker.Item label="Bitte auswählen…" value="" />
                  {activeLabels.map((l) => (
                    <Picker.Item key={l.id} label={`${l.name}${l.type === "event" ? " (event)" : ""}`} value={l.id} />
                  ))}
                </Picker>
              </View>

              <Label>Neues Sublabel</Label>
              <Input value={newSubName} onChangeText={setNewSubName} placeholder="z.B. Transport" />
              <Btn title={createSublabel.isPending ? "Erstelle..." : "Sublabel hinzufügen"} onPress={() => createSublabel.mutate()} disabled={createSublabel.isPending} />

              {(sublabelsQ.data ?? []).length ? (
                <View style={{ gap: 10 }}>
                  {(sublabelsQ.data ?? []).map((s) => (
                    <Card key={s.id} style={{ padding: 10 }}>
                      <H2>{s.name}{s.active ? "" : " (archiviert)"}</H2>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Btn
                            variant="secondary"
                            title={s.active ? "Archivieren" : "Reaktivieren"}
                            onPress={() => toggleSublabel.mutate(s)}
                            disabled={toggleSublabel.isPending}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Btn
                            variant="danger"
                            title="Löschen"
                            onPress={() => {
                              Alert.alert("Sublabel löschen?", "Wenn genutzt, wird es archiviert.", [
                                { text: "Abbrechen", style: "cancel" },
                                { text: "OK", style: "destructive", onPress: () => deleteSublabel.mutate(s) },
                              ]);
                            }}
                            disabled={deleteSublabel.isPending}
                          />
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : (
                <P dim>Keine Sublabels für dieses Label.</P>
              )}
            </Card>

            <H2>Label-Liste</H2>
          </KeyboardAwareScrollView>
        }
        renderItem={({ item }) => (
          <Card>
            <H2>
              {item.name} {!item.active ? "(archiviert)" : ""} {item.type === "event" ? "· event" : ""}
            </H2>
            <P dim>
              Empfänger: {item.recipient_name ?? "—"} · {item.recipient_email ?? "—"}
            </P>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn variant="secondary" title="Bearbeiten" onPress={() => startEdit(item)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="secondary"
                  title={item.active ? "Archivieren" : "Reaktivieren"}
                  onPress={() => toggleLabel.mutate(item)}
                  disabled={toggleLabel.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="danger"
                  title="Löschen"
                  onPress={() => {
                    Alert.alert("Label löschen?", "Wenn genutzt, wird es archiviert.", [
                      { text: "Abbrechen", style: "cancel" },
                      { text: "OK", style: "destructive", onPress: () => deleteLabel.mutate(item) },
                    ]);
                  }}
                  disabled={deleteLabel.isPending}
                />
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}