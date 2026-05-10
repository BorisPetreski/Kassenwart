import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { AmountText, Btn, Card, Divider, H2, Input, Label, P, SectionLabel, StatusBadge, ui } from "../../src/ui/atoms";

type LabelRow = { id: string; name: string; type: "standard" | "event"; active: boolean };
type SublabelRow = { id: string; label_id: string; name: string; active: boolean };
type EventRow = { id: string; title: string; active: boolean };

type PaymentMethod = "member_out_of_pocket" | "company_card";

type InvoiceRow = {
  id: string;
  vendor: string | null;
  amount: any;
  currency: string;
  note: string | null;
  created_at: string;
  status: "submitted" | "reviewed" | "approved" | "paid" | "rejected";
  payment_method: PaymentMethod;
  receipt_bucket: string;
  receipt_path: string;
  label_id: string;
  label?: { name: string } | null;
  sublabel?: { name: string } | null;
  event?: { title: string } | null;
  submitter?: { name: string } | null;
};

type PickedFile = { uri: string; name: string; mimeType: string };

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function fetchLabels(): Promise<LabelRow[]> {
  const { data, error } = await supabase
    .from("labels")
    .select("id,name,type,active")
    .eq("active", true)
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
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,active")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchInvoices(params: { labelId: string | null; status: string | null }): Promise<InvoiceRow[]> {
  let q = supabase
    .from("invoices")
    .select(
      "id,vendor,amount,currency,note,created_at,status,payment_method,receipt_bucket,receipt_path,label_id,label:labels(name),sublabel:sublabels(name),event:events(title),submitter:members(name)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (params.labelId) q = q.eq("label_id", params.labelId);
  if (params.status) q = q.eq("status", params.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any;
}

async function uploadReceipt(params: { orgId: string; userId: string; file: PickedFile }) {
  const { orgId, userId, file } = params;
  const arrayBuffer = await new File(file.uri).arrayBuffer();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `orgs/${orgId}/users/${userId}/invoices/${Date.now()}_${safeName}`;
  const { data, error } = await supabase.storage.from("receipts").upload(path, arrayBuffer, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return { bucket: "receipts", path: data.path };
}

async function openReceipt(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 15);
  if (error) throw error;
  await Linking.openURL(data.signedUrl);
}

const PICKER_CONTAINER = {
  borderRadius: 12,
  overflow: "hidden" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(0,0,0,0.30)",
};

function ActionBtn({
  title,
  onPress,
  kind = "secondary",
  active = false,
}: {
  title: string;
  onPress: () => void;
  kind?: "secondary" | "danger";
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: active
          ? "rgba(37,99,235,0.25)"
          : kind === "danger"
          ? "rgba(155,28,28,0.55)"
          : "rgba(255,255,255,0.07)",
        borderWidth: active ? 1.5 : 1,
        borderColor: active
          ? "#2563EB"
          : kind === "danger"
          ? "rgba(239,68,68,0.25)"
          : "rgba(255,255,255,0.11)",
        alignItems: "center" as const,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: active ? "#93C5FD" : kind === "danger" ? "#FCA5A5" : "#C9D4F2", fontWeight: "700", fontSize: 12 }}>{title}</Text>
    </Pressable>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function InvoicesScreen() {
  const qc = useQueryClient();
  const { orgId, session, role } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isTreasurer = role === "treasurer";

  const [filterLabelId, setFilterLabelId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [labelId, setLabelId] = useState("");
  const [sublabelId, setSublabelId] = useState("");
  const [eventId, setEventId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("member_out_of_pocket");

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);

  const labelsQ = useQuery({ queryKey: ["labels"], queryFn: fetchLabels });
  const eventsQ = useQuery({ queryKey: ["events"], queryFn: fetchEvents });

  const sublabelsQ = useQuery({
    queryKey: ["sublabels", labelId || "none"],
    queryFn: () => fetchSublabels(labelId || null),
  });

  const invoicesQ = useQuery({
    queryKey: ["invoices", filterLabelId || "ALL", filterStatus || "ALLSTATUS"],
    queryFn: () => fetchInvoices({ labelId: filterLabelId || null, status: filterStatus || null }),
  });

  const selectedLabel = useMemo(
    () => (labelsQ.data ?? []).find((l) => l.id === labelId) ?? null,
    [labelsQ.data, labelId]
  );
  const needsEvent = selectedLabel?.type === "event";

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setFile({ uri: a.uri, name: a.name || "invoice.pdf", mimeType: a.mimeType || "application/pdf" });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error(t.invoices.noOrg);
      if (!session?.user?.id) throw new Error(t.invoices.notLoggedIn);
      if (!labelId) throw new Error(t.invoices.noLabel);
      if (needsEvent && !eventId) throw new Error(t.invoices.noEventForLabel);
      const amt = toNumber(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(t.invoices.invalidAmount);
      if (!file) throw new Error(t.invoices.noPdf);

      const uploaded = await uploadReceipt({ orgId, userId: session.user.id, file });
      const { data: memberRow, error: memberErr } = await supabase
        .from("members")
        .select("id,org_id,user_id,email")
        .eq("user_id", session.user.id)
        .eq("org_id", orgId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (memberErr) throw memberErr;
      if (!memberRow?.id) throw new Error(t.invoices.memberNotLinked);

      const { error } = await supabase.from("invoices").insert({
        org_id: orgId,
        submitted_by_user_id: session.user.id,
        submitted_by_member_id: memberRow.id,
        label_id: labelId,
        sublabel_id: sublabelId || null,
        event_id: needsEvent ? eventId : null,
        payment_method: paymentMethod,
        vendor: vendor.trim() || null,
        amount: amt,
        note: note.trim() || null,
        receipt_bucket: uploaded.bucket,
        receipt_path: uploaded.path,
        receipt_file_name: file.name,
        receipt_mime_type: file.mimeType,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setVendor(""); setAmount(""); setNote(""); setLabelId("");
      setSublabelId(""); setEventId(""); setPaymentMethod("member_out_of_pocket"); setFile(null);
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      Alert.alert(t.invoices.submitSuccess, t.invoices.submitSuccessBody);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: InvoiceRow["status"]; method?: PaymentMethod | null }) => {
      const { error } = await supabase.rpc("treasurer_set_invoice_status", {
        p_invoice_id: p.id,
        p_status: p.status,
        p_payment_method: p.method ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  return (
    <View style={ui.screen}>
      <FlatList
        data={invoicesQ.data ?? []}
        keyExtractor={(x) => x.id}
        refreshControl={
          <RefreshControl refreshing={invoicesQ.isFetching} onRefresh={invoicesQ.refetch} tintColor="#4D8AFF" />
        }
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 14 }} enableAutomaticScroll extraScrollHeight={20} keyboardShouldPersistTaps="handled">
            <Card>
              <H2>{t.invoices.submitTitle}</H2>

              <Label>{t.invoices.label}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker
                  selectedValue={labelId}
                  onValueChange={(v) => { setLabelId(String(v)); setSublabelId(""); setEventId(""); }}
                  style={{ color: "#EAF0FF" }}
                  dropdownIconColor="#EAF0FF"
                >
                  <Picker.Item label={t.common.pleaseSelect} value="" />
                  {(labelsQ.data ?? []).map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              {needsEvent ? (
                <>
                  <Label>{t.invoices.event}</Label>
                  <View style={PICKER_CONTAINER}>
                    <Picker selectedValue={eventId} onValueChange={(v) => setEventId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                      <Picker.Item label={t.common.pleaseSelect} value="" />
                      {(eventsQ.data ?? []).map((e) => (
                        <Picker.Item key={e.id} label={e.title} value={e.id} />
                      ))}
                    </Picker>
                  </View>
                </>
              ) : null}

              <Label>{t.invoices.sublabel}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={sublabelId} onValueChange={(v) => setSublabelId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.invoices.noSublabel} value="" />
                  {(sublabelsQ.data ?? []).map((s) => (
                    <Picker.Item key={s.id} label={s.name} value={s.id} />
                  ))}
                </Picker>
              </View>

              <Label>{t.invoices.paymentMethod}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={paymentMethod} onValueChange={(v) => setPaymentMethod(String(v) as PaymentMethod)} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.invoices.paymentPrivate} value="member_out_of_pocket" />
                  <Picker.Item label={t.invoices.paymentCard} value="company_card" />
                </Picker>
              </View>

              <Label>{t.invoices.vendor}</Label>
              <Input value={vendor} onChangeText={setVendor} placeholder={t.invoices.vendorPlaceholder} />

              <Label>{t.invoices.amount}</Label>
              <Input value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={t.invoices.amountPlaceholder} />

              <Label>{t.invoices.note}</Label>
              <Input value={note} onChangeText={setNote} placeholder={t.invoices.notePlaceholder} />

              <Pressable
                onPress={pickPdf}
                style={({ pressed }) => ({
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: "dashed" as const,
                  borderColor: file ? "#4D8AFF" : "rgba(255,255,255,0.15)",
                  backgroundColor: file ? "rgba(46,107,255,0.08)" : "rgba(0,0,0,0.15)",
                  paddingVertical: 14,
                  alignItems: "center" as const,
                  gap: 6,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name={file ? "document-text" : "cloud-upload-outline"} size={22} color={file ? "#4D8AFF" : "#7A8AAD"} />
                <Text style={{ color: file ? "#93C5FD" : "#7A8AAD", fontSize: 13, fontWeight: "600" }}>
                  {file ? file.name : t.invoices.pickPdf}
                </Text>
              </Pressable>

              <Btn
                title={submit.isPending ? t.invoices.submitting : t.invoices.submit}
                onPress={() => submit.mutate()}
                disabled={submit.isPending}
              />
            </Card>

            <Card>
              <H2>{t.invoices.filterTitle}</H2>

              <Label>{t.invoices.filterStatus}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={filterStatus} onValueChange={(v) => setFilterStatus(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.common.all} value="" />
                  <Picker.Item label={t.status.submitted} value="submitted" />
                  <Picker.Item label={t.status.reviewed} value="reviewed" />
                  <Picker.Item label={t.status.approved} value="approved" />
                  <Picker.Item label={t.status.paid} value="paid" />
                  <Picker.Item label={t.status.rejected} value="rejected" />
                </Picker>
              </View>

              <Label>{t.invoices.filterLabel}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker selectedValue={filterLabelId} onValueChange={(v) => setFilterLabelId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label={t.common.all} value="" />
                  {(labelsQ.data ?? []).map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              <P dim>{isTreasurer ? t.invoices.treasurerSeeAll : t.invoices.memberSeeOwn}</P>
            </Card>

            {(invoicesQ.data ?? []).length > 0 ? (
              <SectionLabel title={t.invoices.list} meta={t.common.entries((invoicesQ.data ?? []).length)} />
            ) : null}
          </KeyboardAwareScrollView>
        }
        ListEmptyComponent={
          !invoicesQ.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Ionicons name="receipt-outline" size={40} color="#2A3550" />
              <Text style={{ color: "#4A5672", fontSize: 14 }}>{t.invoices.noInvoices}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#EAF0FF" }}>
                  {item.vendor ?? t.common.unknown}
                </Text>
                <Text style={{ color: "#7A8AAD", fontSize: 12 }}>
                  {item.label?.name ?? "—"}{item.sublabel?.name ? ` · ${item.sublabel.name}` : ""}
                </Text>
              </View>
              <AmountText amount={toNumber(item.amount)} currency={item.currency} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <StatusBadge status={item.status} t={t} />
              <Text style={{ color: "#4A5672", fontSize: 12 }}>
                {item.payment_method === "company_card" ? t.invoices.paymentCardShort : t.invoices.paymentPrivateShort}
              </Text>
            </View>

            {item.event?.title ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="calendar-outline" size={13} color="#7A8AAD" />
                <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{item.event.title}</Text>
              </View>
            ) : null}

            {item.note ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#7A8AAD" />
                <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{item.note}</Text>
              </View>
            ) : null}

            {isTreasurer && item.submitter?.name ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="person-outline" size={13} color="#7A8AAD" />
                <Text style={{ color: "#7A8AAD", fontSize: 13 }}>{item.submitter.name}</Text>
              </View>
            ) : null}

            <Divider />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#4A5672", fontSize: 12 }}>{formatDate(item.created_at)}</Text>
              <Pressable
                onPress={async () => {
                  try {
                    await openReceipt(item.receipt_bucket, item.receipt_path);
                  } catch (e: any) {
                    Alert.alert(t.common.error, e?.message ?? t.invoices.pdfError);
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  opacity: pressed ? 0.65 : 1,
                  backgroundColor: "rgba(77,138,255,0.12)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                })}
              >
                <Ionicons name="document-text-outline" size={14} color="#4D8AFF" />
                <Text style={{ color: "#4D8AFF", fontSize: 13, fontWeight: "700" }}>{t.invoices.openPdf}</Text>
              </Pressable>
            </View>

            {isTreasurer ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <ActionBtn
                    title={t.invoices.actionApprove}
                    onPress={() => setStatus.mutate({ id: item.id, status: "approved" })}
                    active={item.status === "approved"}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <ActionBtn title={t.invoices.actionPayPrivate} onPress={() => setStatus.mutate({ id: item.id, status: "paid", method: "member_out_of_pocket" })} />
                  <ActionBtn title={t.invoices.actionPayCard} onPress={() => setStatus.mutate({ id: item.id, status: "paid", method: "company_card" })} />
                  <ActionBtn kind="danger" title={t.invoices.actionReject} onPress={() => setStatus.mutate({ id: item.id, status: "rejected" })} />
                </View>
              </>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}
