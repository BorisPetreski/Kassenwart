import React, { useMemo, useState } from "react";
import { Alert, FlatList, Share, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";

type LabelRow = {
  id: string;
  name: string;
  type: "standard" | "event";
  recipient_name: string | null;
  recipient_email: string | null;
  active: boolean;
};

type InvoiceRow = {
  id: string;
  vendor: string | null;
  amount: any;
  currency: string;
  note: string | null;
  created_at: string;
  receipt_bucket: string;
  receipt_path: string;
  label_id: string;
  event_id: string | null;
  label?: { name: string } | null;
  sublabel?: { name: string } | null;
  event?: { title: string } | null;
};

function toNum(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function monthRangeUTC(offsetMonths: number) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + offsetMonths;
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return { start, end };
}

async function fetchLabels(): Promise<LabelRow[]> {
  const { data, error } = await supabase
    .from("labels")
    .select("id,name,type,recipient_name,recipient_email,active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchInvoicesInRange(startISO: string, endISO: string): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id,vendor,amount,currency,note,created_at,receipt_bucket,receipt_path,label_id,event_id,label:labels(name),sublabel:sublabels(name),event:events(title)")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as any;
}

export default function AdminScreen() {
  const { role } = useAuth();
  const isTreasurer = role === "treasurer";

  const [period, setPeriod] = useState<"this" | "last">("this");
  const range = useMemo(() => monthRangeUTC(period === "this" ? 0 : -1), [period]);
  const startISO = range.start.toISOString();
  const endISO = range.end.toISOString();

  const labelsQ = useQuery({ queryKey: ["labels_all"], queryFn: fetchLabels, enabled: isTreasurer });
  const invoicesQ = useQuery({
    queryKey: ["admin_invoices", startISO, endISO],
    queryFn: () => fetchInvoicesInRange(startISO, endISO),
    enabled: isTreasurer,
  });

  const labels = labelsQ.data ?? [];
  const invoices = invoicesQ.data ?? [];

  const totals = useMemo(() => {
    const byLabel = new Map<string, number>();
    const byEvent = new Map<string, number>();

    for (const inv of invoices) {
      const amt = toNum(inv.amount);
      const labelName = inv.label?.name ?? "Unbekannt";
      byLabel.set(labelName, (byLabel.get(labelName) ?? 0) + amt);

      if (inv.event?.title) {
        const e = inv.event.title;
        byEvent.set(e, (byEvent.get(e) ?? 0) + amt);
      }
    }

    const labelTotals = Array.from(byLabel.entries()).sort((a, b) => b[1] - a[1]);
    const eventTotals = Array.from(byEvent.entries()).sort((a, b) => b[1] - a[1]);

    const sum = invoices.reduce((s, inv) => s + toNum(inv.amount), 0);

    return { labelTotals, eventTotals, sum };
  }, [invoices]);

  // statement builder
  const [labelId, setLabelId] = useState("");
  const selectedLabel = useMemo(() => labels.find((l) => l.id === labelId) ?? null, [labels, labelId]);

  const statementInvoices = useMemo(() => {
    if (!labelId) return [];
    return invoices.filter((i) => i.label_id === labelId);
  }, [invoices, labelId]);

  const generateStatement = useMutation({
    mutationFn: async () => {
      if (!labelId) throw new Error("Bitte Label wählen.");
      if (!selectedLabel) throw new Error("Label nicht gefunden.");

      const rec = selectedLabel.recipient_email ?? "(kein Empfänger gesetzt)";
      const title = `Monatsabrechnung: ${selectedLabel.name}`;
      const periodLabel = period === "this" ? "Dieser Monat (UTC)" : "Letzter Monat (UTC)";

      const total = statementInvoices.reduce((s, inv) => s + toNum(inv.amount), 0);

      // create signed urls (7 days)
      const lines: string[] = [];
      lines.push(title);
      lines.push(`Zeitraum: ${periodLabel}`);
      lines.push(`Empfänger: ${selectedLabel.recipient_name ?? "—"} <${rec}>`);
      lines.push(`Summe: ${total.toFixed(2)} EUR`);
      lines.push("");
      lines.push("Belege:");

      // limit to avoid huge waits; you can increase later
      const max = 40;
      const slice = statementInvoices.slice(0, max);

      for (const inv of slice) {
        const { data, error } = await supabase.storage
          .from(inv.receipt_bucket)
          .createSignedUrl(inv.receipt_path, 60 * 60 * 24 * 7);

        if (error) throw error;

        const when = new Date(inv.created_at).toLocaleDateString();
        const vendor = inv.vendor ?? "Unbekannt";
        const amt = toNum(inv.amount).toFixed(2);
        const sub = inv.sublabel?.name ? ` · ${inv.sublabel.name}` : "";
        const ev = inv.event?.title ? ` · Event: ${inv.event.title}` : "";
        const note = inv.note ? ` · Notiz: ${inv.note}` : "";

        lines.push(`- ${when} · ${vendor} · ${amt} EUR${sub}${ev}${note}`);
        lines.push(`  ${data.signedUrl}`);
      }

      if (statementInvoices.length > max) {
        lines.push("");
        lines.push(`Hinweis: ${statementInvoices.length - max} weitere Belege nicht gelistet (Limit ${max}).`);
      }

      return lines.join("\n");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <H1>Übersicht</H1>
          <Card>
            <P>Nur der Kassenwart hat Zugriff auf diese Übersicht.</P>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={totals.labelTotals}
        keyExtractor={(x) => x[0]}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 12 }}>
            <H1>Übersicht</H1>

            <Card>
              <H2>Zeitraum</H2>
              <Label>Monat</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={period} onValueChange={(v) => setPeriod(String(v) as any)}>
                  <Picker.Item label="Dieser Monat" value="this" />
                  <Picker.Item label="Letzter Monat" value="last" />
                </Picker>
              </View>
              <P dim>
                Range: {range.start.toISOString().slice(0, 10)} → {range.end.toISOString().slice(0, 10)}
              </P>
              <P dim>Summe aller Rechnungen im Zeitraum: {totals.sum.toFixed(2)} EUR</P>
            </Card>

            <Card>
              <H2>Monatsabrechnung erstellen</H2>
              <Label>Label</Label>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                <Picker selectedValue={labelId} onValueChange={(v) => setLabelId(String(v))}>
                  <Picker.Item label="Bitte auswählen…" value="" />
                  {labels
                    .filter((l) => l.active)
                    .map((l) => (
                      <Picker.Item key={l.id} label={`${l.name}${l.type === "event" ? " (event)" : ""}`} value={l.id} />
                    ))}
                </Picker>
              </View>

              {selectedLabel ? (
                <>
                  <P dim>Empfänger: {selectedLabel.recipient_name ?? "—"} · {selectedLabel.recipient_email ?? "—"}</P>
                  <P dim>Belege im Zeitraum: {statementInvoices.length}</P>
                </>
              ) : (
                <P dim>Wähle ein Label, um Abrechnung zu generieren.</P>
              )}

              <Btn
                title={generateStatement.isPending ? "Generiere..." : "Abrechnung generieren & teilen"}
                onPress={async () => {
                  try {
                    const msg = await generateStatement.mutateAsync();
                    await Share.share({ message: msg });
                  } catch {}
                }}
                disabled={generateStatement.isPending || !labelId}
              />
              <P dim>Links sind Signed URLs (7 Tage gültig). Empfänger braucht keinen Account.</P>
            </Card>

            <Card>
              <H2>Totals nach Event</H2>
              {totals.eventTotals.length === 0 ? <P dim>Keine Event-Rechnungen im Zeitraum.</P> : null}
              {totals.eventTotals.slice(0, 8).map(([event, sum]) => (
                <P key={event}>
                  {event}: {sum.toFixed(2)} EUR
                </P>
              ))}
              {totals.eventTotals.length > 8 ? <P dim>+{totals.eventTotals.length - 8} weitere</P> : null}
            </Card>

            <H2>Totals nach Label</H2>
          </KeyboardAwareScrollView>
        }
        renderItem={({ item }) => {
          const [label, sum] = item;
          return (
            <Card>
              <H2>{label}</H2>
              <P>{sum.toFixed(2)} EUR</P>
            </Card>
          );
        }}
      />
    </View>
  );
}