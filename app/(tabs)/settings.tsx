import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useT } from "../../src/i18n/LanguageProvider";
import type { Lang } from "../../src/i18n/translations";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H2, Input, Label, P, SectionLabel, ui } from "../../src/ui/atoms";

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

const PICKER_CONTAINER = {
  borderRadius: 12,
  overflow: "hidden" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(0,0,0,0.30)",
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

function LanguageSwitcher() {
  const { lang, setLang, t } = useT();

  const langs: { code: Lang; label: string }[] = [
    { code: "de", label: t.language.de },
    { code: "en", label: t.language.en },
  ];

  return (
    <Card>
      <H2>{t.language.tab}</H2>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {langs.map(({ code, label }) => {
          const active = lang === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLang(code)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 11,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: active ? "#2E6BFF" : "rgba(255,255,255,0.07)",
                borderWidth: 1,
                borderColor: active ? "#2E6BFF" : "rgba(255,255,255,0.12)",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: active ? "#fff" : "#C9D4F2", fontWeight: "700", fontSize: 14 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isTreasurer = role === "treasurer";

  const labelsQ = useQuery({ queryKey: ["labels_all"], queryFn: fetchLabels, enabled: isTreasurer });
  const labels = labelsQ.data ?? [];
  const activeLabels = useMemo(() => labels.filter((l) => l.active), [labels]);

  // ── Create label ────────────────────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"standard" | "event">("standard");
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmail, setNewRecEmail] = useState("");

  const createLabel = useMutation({
    mutationFn: async () => {
      const n = newName.trim();
      if (!n) throw new Error(t.settings.nameRequired);
      const email = newRecEmail.trim();
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
      setNewName(""); setNewRecName(""); setNewRecEmail(""); setNewType("standard");
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
      Alert.alert(t.common.ok, t.settings.createSuccess);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  // ── Inline edit ─────────────────────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"standard" | "event">("standard");
  const [editRecName, setEditRecName] = useState("");
  const [editRecEmail, setEditRecEmail] = useState("");

  const openEdit = (l: LabelRow) => {
    setEditId(l.id);
    setEditName(l.name);
    setEditType(l.type);
    setEditRecName(l.recipient_name ?? "");
    setEditRecEmail(l.recipient_email ?? "");
  };

  const cancelEdit = () => setEditId(null);

  const saveLabel = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const n = editName.trim();
      if (!n) throw new Error(t.settings.nameRequired);
      const email = editRecEmail.trim();
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
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
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
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const deleteLabel = useMutation({
    mutationFn: async (l: LabelRow) => {
      const { data: used, error: usedErr } = await supabase.from("invoices").select("id").eq("label_id", l.id).limit(1);
      if (usedErr) throw usedErr;
      if ((used ?? []).length > 0) {
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
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ["labels_all"] });
      await qc.invalidateQueries({ queryKey: ["labels"] });
      Alert.alert(t.common.ok, t.settings.deleteSuccess(res.mode));
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  // ── Sublabels ───────────────────────────────────────────────────────────────
  const [parentLabelId, setParentLabelId] = useState("");
  const sublabelsQ = useQuery({
    queryKey: ["sublabels", parentLabelId || "none"],
    queryFn: () => fetchSublabels(parentLabelId || null),
    enabled: isTreasurer,
  });

  const [newSubName, setNewSubName] = useState("");

  const createSublabel = useMutation({
    mutationFn: async () => {
      if (!parentLabelId) throw new Error(t.common.pleaseSelect);
      const n = newSubName.trim();
      if (!n) throw new Error(t.settings.nameRequired);
      const { error } = await supabase.from("sublabels").insert({ label_id: parentLabelId, name: n, active: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewSubName("");
      await qc.invalidateQueries({ queryKey: ["sublabels", parentLabelId || "none"] });
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const toggleSublabel = useMutation({
    mutationFn: async (s: SublabelRow) => {
      const { error } = await supabase.from("sublabels").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["sublabels", parentLabelId || "none"] }),
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const deleteSublabel = useMutation({
    mutationFn: async (s: SublabelRow) => {
      const { data: used, error: usedErr } = await supabase.from("invoices").select("id").eq("sublabel_id", s.id).limit(1);
      if (usedErr) throw usedErr;
      if ((used ?? []).length > 0) {
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
      Alert.alert(t.common.ok, t.settings.deleteSuccess(res.mode));
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  // ── Non-treasurer view ──────────────────────────────────────────────────────
  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={[ui.content, { gap: 14, paddingBottom: 56 + insets.bottom + 16 }]}>
          <LanguageSwitcher />
        </View>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={labels}
        keyExtractor={(l) => l.id}
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <KeyboardAwareScrollView
            style={{ gap: 14 }}
            keyboardShouldPersistTaps="handled"
            enableAutomaticScroll
            extraScrollHeight={20}
          >
            <LanguageSwitcher />

            {/* ── Create label ── */}
            <Card>
              <H2>{t.settings.createTitle}</H2>

              <Label>{t.settings.labelName}</Label>
              <Input value={newName} onChangeText={setNewName} placeholder={t.settings.labelNamePlaceholder} />

              <Label>{t.settings.labelType}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={newType} onValueChange={(v) => setNewType(String(v) as any)} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.settings.typeStandard} value="standard" />
                  <Picker.Item label={t.settings.typeEvent} value="event" />
                </Picker>
              </View>

              <Label>{t.settings.recipientName}</Label>
              <Input value={newRecName} onChangeText={setNewRecName} placeholder={t.settings.recipientNamePlaceholder} />

              <Label>{t.settings.recipientEmail}</Label>
              <Input value={newRecEmail} onChangeText={setNewRecEmail} autoCapitalize="none" keyboardType="email-address" placeholder={t.settings.recipientEmailPlaceholder} />

              <Btn
                title={createLabel.isPending ? t.settings.creating : t.settings.createBtn}
                onPress={() => createLabel.mutate()}
                disabled={createLabel.isPending}
              />
            </Card>


            {/* ── Sublabels ── */}
            <Card>
              <H2>{t.settings.sublabelsTitle}</H2>
              <Label>{t.invoices.label}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={parentLabelId} onValueChange={(v) => setParentLabelId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.common.pleaseSelect} value="" />
                  {activeLabels.map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              {parentLabelId ? (
                <>
                  <Label>{t.settings.addSublabelPlaceholder}</Label>
                  <Input value={newSubName} onChangeText={setNewSubName} placeholder={t.settings.addSublabelPlaceholder} />
                  <Btn
                    title={createSublabel.isPending ? t.settings.creating : t.settings.addSublabel}
                    onPress={() => createSublabel.mutate()}
                    disabled={createSublabel.isPending}
                  />

                  {(sublabelsQ.data ?? []).length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {(sublabelsQ.data ?? []).map((s) => (
                        <Card key={s.id} style={{ padding: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ gap: 2 }}>
                              <Text style={{ color: "#EAF0FF", fontWeight: "700", fontSize: 14 }}>{s.name}</Text>
                              {!s.active && (
                                <Text style={{ color: "#F87171", fontSize: 11 }}>{t.settings.archived}</Text>
                              )}
                            </View>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Btn
                                variant="secondary"
                                title={s.active ? t.settings.archive : t.settings.reactivate}
                                onPress={() => toggleSublabel.mutate(s)}
                                disabled={toggleSublabel.isPending}
                              />
                              <Btn
                                variant="danger"
                                title={t.settings.delete}
                                onPress={() => Alert.alert(t.settings.deleteTitle, t.settings.deleteBody, [
                                  { text: t.common.cancel, style: "cancel" },
                                  { text: t.common.delete, style: "destructive", onPress: () => deleteSublabel.mutate(s) },
                                ])}
                                disabled={deleteSublabel.isPending}
                              />
                            </View>
                          </View>
                        </Card>
                      ))}
                    </View>
                  ) : (
                    <P dim>{t.settings.noLabels}</P>
                  )}
                </>
              ) : (
                <P dim>{t.admin.chooseLabel}</P>
              )}
            </Card>

            <SectionLabel title={t.settings.list} meta={t.admin.labels(labels.length)} />

            {labels.length === 0 && !labelsQ.isFetching ? (
              <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
                <Ionicons name="pricetag-outline" size={36} color="#2A3550" />
                <P dim>{t.settings.noLabels}</P>
              </View>
            ) : null}
          </KeyboardAwareScrollView>
        }
        renderItem={({ item }) => {
          const isEditing = editId === item.id;

          return (
            <Card>
              {isEditing ? (
                <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" scrollEnabled={false}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Ionicons name="create-outline" size={16} color="#4D8AFF" />
                    <Text style={{ color: "#4D8AFF", fontWeight: "800", fontSize: 14 }}>{t.settings.editTitle}: {item.name}</Text>
                  </View>

                  <Label>{t.settings.editName}</Label>
                  <Input value={editName} onChangeText={setEditName} placeholder={t.settings.labelNamePlaceholder} />

                  <Label>{t.settings.labelType}</Label>
                  <View style={PICKER_CONTAINER}>
                    <Picker selectedValue={editType} onValueChange={(v) => setEditType(String(v) as any)} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                      <Picker.Item label={t.settings.typeStandard} value="standard" />
                      <Picker.Item label={t.settings.typeEvent} value="event" />
                    </Picker>
                  </View>

                  <Label>{t.settings.editRecipientName}</Label>
                  <Input value={editRecName} onChangeText={setEditRecName} placeholder={t.settings.recipientNamePlaceholder} />

                  <Label>{t.settings.editRecipientEmail}</Label>
                  <Input value={editRecEmail} onChangeText={setEditRecEmail} autoCapitalize="none" keyboardType="email-address" placeholder={t.settings.recipientEmailPlaceholder} />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Btn
                        title={saveLabel.isPending ? t.settings.saving : t.settings.save}
                        onPress={() => saveLabel.mutate()}
                        disabled={saveLabel.isPending}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn variant="secondary" title={t.settings.cancel} onPress={cancelEdit} />
                    </View>
                  </View>
                </KeyboardAwareScrollView>
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ gap: 3, flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={{ color: "#EAF0FF", fontWeight: "800", fontSize: 15 }}>{item.name}</Text>
                        {item.type === "event" && (
                          <View style={{ backgroundColor: "rgba(99,102,241,0.18)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: "#A5B4FC", fontSize: 11, fontWeight: "700" }}>{t.settings.typeEventBadge}</Text>
                          </View>
                        )}
                        {!item.active && (
                          <View style={{ backgroundColor: "rgba(248,113,113,0.15)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: "#FCA5A5", fontSize: 11, fontWeight: "700" }}>{t.settings.archived}</Text>
                          </View>
                        )}
                      </View>
                      {(item.recipient_name || item.recipient_email) && (
                        <Text style={{ color: "#7A8AAD", fontSize: 12 }}>
                          {item.recipient_name ?? "—"} · {item.recipient_email ?? "—"}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Btn variant="secondary" title={t.settings.editTitle} onPress={() => openEdit(item)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn
                        variant="secondary"
                        title={item.active ? t.settings.archive : t.settings.reactivate}
                        onPress={() => toggleLabel.mutate(item)}
                        disabled={toggleLabel.isPending}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn
                        variant="danger"
                        title={t.settings.delete}
                        onPress={() => Alert.alert(t.settings.deleteTitle, t.settings.deleteBody, [
                          { text: t.common.cancel, style: "cancel" },
                          { text: t.common.delete, style: "destructive", onPress: () => deleteLabel.mutate(item) },
                        ])}
                        disabled={deleteLabel.isPending}
                      />
                    </View>
                  </View>
                </>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}
