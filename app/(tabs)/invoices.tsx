import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  View,
  Pressable,
  Text,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../src/lib/supabase";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";
import { useAuth } from "../../src/providers/AuthProvider";

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

  const arrayBuffer = await new File(file.uri).arrayBuffer(); // no base64, no legacy

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `orgs/${orgId}/users/${userId}/invoices/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage.from("receipts").upload(path, arrayBuffer, {
    contentType: file.mimeType,
    upsert: false,
  });

  if (error) {
  console.log("INVOICE INSERT ERROR", error);
  throw error;
}
  return { bucket: "receipts", path: data.path };
}

async function openReceipt(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 15);
  if (error) throw error;
  await Linking.openURL(data.signedUrl);
}

function TinyBtn({
  title,
  onPress,
  kind = "secondary",
}: {
  title: string;
  onPress: () => void;
  kind?: "secondary" | "danger";
}) {
  const bg = kind === "danger" ? "#B42318" : "rgba(255,255,255,0.08)";
  const border = "rgba(255,255,255,0.12)";

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#EAF0FF", fontWeight: "900", fontSize: 12 }}>{title}</Text>
    </Pressable>
  );
}

export default function InvoicesScreen() {
  const qc = useQueryClient();
  const { orgId, session, role } = useAuth();
  const isTreasurer = role === "treasurer";

  // filters
  const [filterLabelId, setFilterLabelId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // form state
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
    setFile({
      uri: a.uri,
      name: a.name || "invoice.pdf",
      mimeType: a.mimeType || "application/pdf",
    });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Keine Organisation (Onboarding).");
      if (!session?.user?.id) throw new Error("Nicht eingeloggt.");
      if (!labelId) throw new Error("Bitte Label auswählen.");
      if (needsEvent && !eventId) throw new Error("Bitte Veranstaltung auswählen.");
      const amt = toNumber(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Bitte gültigen Betrag eingeben.");
      if (!file) throw new Error("Bitte PDF auswählen.");

      const uploaded = await uploadReceipt({ orgId, userId: session.user.id, file });
      const { data: memberRow, error: memberErr } = await supabase
  .from("members")
  .select("id,org_id,user_id,email")
  .eq("user_id", session.user.id)
  .eq("org_id", orgId)          // ✅ add this
  .eq("active", true)
  .limit(1)
  .maybeSingle();

if (memberErr) throw memberErr;
if (!memberRow?.id) {
  throw new Error("Dein Account ist noch nicht als Mitglied verknüpft. Bitte 'Beitreten' im Onboarding nutzen.");
}
      const { error } = await supabase.from("invoices").insert({
  org_id: orgId,                          // ✅ add
  submitted_by_user_id: session.user.id,  // ✅ add
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
if (error) {
  console.log("INVOICE INSERT ERROR", error);
  throw error;
}
    },
    onSuccess: async () => {
      setVendor("");
      setAmount("");
      setNote("");
      setLabelId("");
      setSublabelId("");
      setEventId("");
      setPaymentMethod("member_out_of_pocket");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      Alert.alert("OK", "Rechnung eingereicht.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  // ✅ treasurer status updates go through RPC (ensures ledger logic)
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
      await qc.invalidateQueries({ queryKey: ["board"] }); // ledger may change
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  return (
    <View style={ui.screen}>
      <FlatList
        data={invoicesQ.data ?? []}
        keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={invoicesQ.isFetching} onRefresh={invoicesQ.refetch} tintColor="#EAF0FF" />}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <H1>Rechnungen</H1>

            <Card>
              <H2>Rechnung einreichen</H2>

              <Label>Label</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                <Picker
                  selectedValue={labelId}
                  onValueChange={(v) => {
                    setLabelId(String(v));
                    setSublabelId("");
                    setEventId("");
                  }}
                  style={{ color: "#EAF0FF" }}
                  dropdownIconColor="#EAF0FF"
                >
                  <Picker.Item label="Bitte auswählen…" value="" />
                  {(labelsQ.data ?? []).map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              {needsEvent ? (
                <>
                  <Label>Veranstaltung</Label>
                  <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                    <Picker selectedValue={eventId} onValueChange={(v) => setEventId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                      <Picker.Item label="Bitte auswählen…" value="" />
                      {(eventsQ.data ?? []).map((e) => (
                        <Picker.Item key={e.id} label={e.title} value={e.id} />
                      ))}
                    </Picker>
                  </View>
                </>
              ) : null}

              <Label>Sublabel (optional)</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                <Picker selectedValue={sublabelId} onValueChange={(v) => setSublabelId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label="Kein Sublabel" value="" />
                  {(sublabelsQ.data ?? []).map((s) => (
                    <Picker.Item key={s.id} label={s.name} value={s.id} />
                  ))}
                </Picker>
              </View>

              <Label>Zahlart</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                <Picker selectedValue={paymentMethod} onValueChange={(v) => setPaymentMethod(String(v) as PaymentMethod)} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label="Privat bezahlt (Erstattung)" value="member_out_of_pocket" />
                  <Picker.Item label="CC-Karte (keine Erstattung)" value="company_card" />
                </Picker>
              </View>

              <Label>Vendor (optional)</Label>
              <Input value={vendor} onChangeText={setVendor} placeholder="z.B. Bauhaus" />

              <Label>Betrag</Label>
              <Input value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="z.B. 12.50" />

              <Label>Notiz (optional)</Label>
              <Input value={note} onChangeText={setNote} placeholder="Kurze Notiz" />

              <Btn title={file ? `PDF: ${file.name}` : "PDF auswählen"} variant="secondary" onPress={pickPdf} />
              <Btn title={submit.isPending ? "Sende..." : "Einreichen"} onPress={() => submit.mutate()} disabled={submit.isPending} />
            </Card>

            <Card>
              <H2>Filter</H2>

              <Label>Status</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                <Picker selectedValue={filterStatus} onValueChange={(v) => setFilterStatus(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label="Alle" value="" />
                  <Picker.Item label="Eingereicht" value="submitted" />
                  <Picker.Item label="Überprüft" value="reviewed" />
                  <Picker.Item label="Angenommen" value="approved" />
                  <Picker.Item label="Eingetragen" value="paid" />
                  <Picker.Item label="Abgelehnt" value="rejected" />
                </Picker>
              </View>

              <Label>Label</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                <Picker selectedValue={filterLabelId} onValueChange={(v) => setFilterLabelId(String(v))} style={{ color: "#EAF0FF" }} dropdownIconColor="#EAF0FF">
                  <Picker.Item label="Alle" value="" />
                  {(labelsQ.data ?? []).map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              <P dim>{isTreasurer ? "Treasurer sieht alle Rechnungen." : "Du siehst nur deine eigenen Rechnungen."}</P>
            </Card>

            <H2>Liste</H2>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <H2>{item.vendor ?? "Unbekannt"}</H2>
            <P>
              {toNumber(item.amount)} {item.currency} · {item.status}
            </P>

            <P dim>
              Zahlung: {item.payment_method === "company_card" ? "Firmenkarte" : "Privat (Erstattung)"}
            </P>

            <P dim>
              Label: {item.label?.name ?? "—"} · Sublabel: {item.sublabel?.name ?? "—"}
            </P>
            {item.event?.title ? <P dim>Event: {item.event.title}</P> : null}
            {item.note ? <P dim>Notiz: {item.note}</P> : null}

            {isTreasurer ? <P dim>Eingereicht von: {item.submitter?.name ?? "—"}</P> : null}

            <Btn
              title="PDF öffnen"
              variant="secondary"
              onPress={async () => {
                try {
                  await openReceipt(item.receipt_bucket, item.receipt_path);
                } catch (e: any) {
                  Alert.alert("Fehler", e?.message ?? "Kann PDF nicht öffnen.");
                }
              }}
            />

            {isTreasurer ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TinyBtn title="Überprüfen" onPress={() => setStatus.mutate({ id: item.id, status: "reviewed" })} />
                <TinyBtn title="Annehmen" onPress={() => setStatus.mutate({ id: item.id, status: "approved" })} />
              </View>
            ) : null}

            {isTreasurer ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TinyBtn title="Eingetragen (Erstattung)" onPress={() => setStatus.mutate({ id: item.id, status: "paid", method: "member_out_of_pocket" })} />
                <TinyBtn title="Eingetragen (Karte)" onPress={() => setStatus.mutate({ id: item.id, status: "paid", method: "company_card" })} />
                <TinyBtn kind="danger" title="Abgelehnt" onPress={() => setStatus.mutate({ id: item.id, status: "rejected" })} />
              </View>
            ) : null}

            <P dim>{new Date(item.created_at).toLocaleString()}</P>
          </Card>
        )}
      />
    </View>
  );
}