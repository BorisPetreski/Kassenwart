import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H2, Label, P, SectionLabel, ui } from "../../src/ui/atoms";

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
  status: string;
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
    .select("id,vendor,amount,currency,note,status,created_at,receipt_bucket,receipt_path,label_id,event_id,label:labels(name),sublabel:sublabels(name),event:events(title)")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(2000);
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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function AdminScreen() {
  const { role } = useAuth();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
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
      const labelName = inv.label?.name ?? t.common.unknown;
      byLabel.set(labelName, (byLabel.get(labelName) ?? 0) + amt);
      if (inv.event?.title) {
        byEvent.set(inv.event.title, (byEvent.get(inv.event.title) ?? 0) + amt);
      }
    }
    const labelTotals = Array.from(byLabel.entries()).sort((a, b) => b[1] - a[1]);
    const eventTotals = Array.from(byEvent.entries()).sort((a, b) => b[1] - a[1]);
    const sum = invoices.reduce((s, inv) => s + toNum(inv.amount), 0);
    return { labelTotals, eventTotals, sum };
  }, [invoices, t]);

  const [labelId, setLabelId] = useState("");
  const [exportFiles, setExportFiles] = useState<{ excel: string; pdf: string } | null>(null);

  const selectedLabel = useMemo(() => labels.find((l) => l.id === labelId) ?? null, [labels, labelId]);

  const statementInvoices = useMemo(() => {
    if (!labelId) return [];
    return invoices.filter((i) => i.label_id === labelId);
  }, [invoices, labelId]);

  const generate = useMutation({
    mutationFn: async (): Promise<{ excelUri: string; pdfUri: string }> => {
      if (!labelId) throw new Error(t.admin.errorNoLabel);
      if (!selectedLabel) throw new Error(t.admin.errorLabelNotFound);

      const locale = lang === "de" ? "de-DE" : "en-GB";
      const periodLabel = period === "this" ? t.admin.statementPeriodThis : t.admin.statementPeriodLast;
      const total = statementInvoices.reduce((s, inv) => s + toNum(inv.amount), 0);
      const recipient = `${selectedLabel.recipient_name ?? "—"} · ${selectedLabel.recipient_email ?? t.admin.statementNoRecipient}`;
      const max = 50;
      const slice = statementInvoices.slice(0, max);
      const fileName = `Abrechnung_${selectedLabel.name.replace(/\s+/g, "_")}_${range.start.toISOString().slice(0, 7)}`;

      // Fetch signed URLs in parallel
      const signedUrls = await Promise.all(
        slice.map(async (inv) => {
          const { data, error } = await supabase.storage
            .from(inv.receipt_bucket)
            .createSignedUrl(inv.receipt_path, 60 * 60 * 24 * 7);
          if (error) throw error;
          return data.signedUrl;
        })
      );

      // ── Excel ──────────────────────────────────────────────────────────────
      const headerRow = [
        t.admin.colDate, t.admin.colVendor, t.admin.colAmount,
        t.admin.colLabel, t.admin.colSublabel, t.admin.colEvent,
        t.admin.colNote, t.admin.colReceipt,
      ];
      const dataRows = slice.map((inv, i) => [
        new Date(inv.created_at).toLocaleDateString(locale),
        inv.vendor ?? "",
        toNum(inv.amount),
        inv.label?.name ?? "",
        inv.sublabel?.name ?? "",
        inv.event?.title ?? "",
        inv.note ?? "",
        signedUrls[i] ?? "",
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        headerRow,
        ...dataRows,
        [],
        [t.admin.statementSum, "", total, "", "", "", "", ""],
      ]);
      ws["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 16 },
        { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 70 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Abrechnung");
      const xlsxBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const excelUri = (FileSystem.cacheDirectory ?? "") + fileName + ".xlsx";
      await FileSystem.writeAsStringAsync(excelUri, xlsxBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // ── PDF ────────────────────────────────────────────────────────────────
      const tableRows = slice
        .map((inv, i) => `
          <tr>
            <td>${esc(new Date(inv.created_at).toLocaleDateString(locale))}</td>
            <td>${esc(inv.vendor ?? "—")}</td>
            <td style="text-align:right">${toNum(inv.amount).toFixed(2)}</td>
            <td>${esc(inv.label?.name ?? "—")}</td>
            <td>${esc(inv.sublabel?.name ?? "—")}</td>
            <td>${esc(inv.event?.title ?? "—")}</td>
            <td>${esc(inv.note ?? "—")}</td>
            <td><a href="${signedUrls[i] ?? "#"}">Link</a></td>
          </tr>`)
        .join("");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;font-size:10px;margin:24px;color:#111}
  h1{font-size:15px;margin-bottom:4px}
  .meta{color:#555;margin-bottom:14px;font-size:10px}
  table{width:100%;border-collapse:collapse}
  th{background:#e5e7eb;text-align:left;padding:4px 6px;font-size:9px;border-bottom:2px solid #ccc}
  td{padding:3px 6px;border-bottom:1px solid #eee;font-size:9px;word-break:break-word}
  .total td{font-weight:bold;background:#f3f4f6;border-top:2px solid #ccc}
  a{color:#2563eb}
  .note{color:#aaa;font-size:8px;margin-top:12px}
</style></head><body>
  <h1>${esc(t.admin.statementTitle)}: ${esc(selectedLabel.name)}</h1>
  <div class="meta">
    ${esc(t.admin.period)}: ${esc(periodLabel)} &nbsp;·&nbsp;
    ${esc(t.admin.statementRecipient)}: ${esc(recipient)} &nbsp;·&nbsp;
    ${esc(t.admin.statementSum)}: ${total.toFixed(2)} EUR
  </div>
  <table>
    <thead><tr>
      <th>${esc(t.admin.colDate)}</th><th>${esc(t.admin.colVendor)}</th>
      <th>${esc(t.admin.colAmount)}</th><th>${esc(t.admin.colLabel)}</th>
      <th>${esc(t.admin.colSublabel)}</th><th>${esc(t.admin.colEvent)}</th>
      <th>${esc(t.admin.colNote)}</th><th>${esc(t.admin.colReceipt)}</th>
    </tr></thead>
    <tbody>
      ${tableRows}
      <tr class="total">
        <td colspan="2">${esc(t.admin.statementSum)}</td>
        <td style="text-align:right">${total.toFixed(2)} EUR</td>
        <td colspan="5"></td>
      </tr>
    </tbody>
  </table>
  ${statementInvoices.length > max
    ? `<p class="note">${esc(t.admin.statementNote(statementInvoices.length - max, max))}</p>`
    : ""}
  <p class="note">${esc(t.admin.signedUrlNote)}</p>
</body></html>`;

      const { uri: rawPdfUri } = await Print.printToFileAsync({ html });
      const pdfUri = (FileSystem.cacheDirectory ?? "") + fileName + ".pdf";
      await FileSystem.copyAsync({ from: rawPdfUri, to: pdfUri });

      return { excelUri, pdfUri };
    },
    onSuccess: ({ excelUri, pdfUri }) => setExportFiles({ excel: excelUri, pdf: pdfUri }),
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <Card><P>{t.admin.noAccess}</P></Card>
        </View>
      </View>
    );
  }

  const periodLabel = range.start.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric" });

  return (
    <View style={ui.screen}>
      <FlatList
        data={totals.labelTotals}
        keyExtractor={(x) => x[0]}
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 14 }} enableAutomaticScroll extraScrollHeight={20} keyboardShouldPersistTaps="handled">
            <Card>
              <H2>{t.admin.period}</H2>
              <Label>{t.admin.month}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker
                  selectedValue={period}
                  onValueChange={(v) => { setPeriod(String(v) as any); setExportFiles(null); }}
                  style={{ color: "#EAF0FF" }}
                  dropdownIconColor="#EAF0FF"
                >
                  <Picker.Item label={t.admin.thisMonth} value="this" />
                  <Picker.Item label={t.admin.lastMonth} value="last" />
                </Picker>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <P dim>{periodLabel}</P>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#EAF0FF" }}>
                    {totals.sum.toFixed(2)} <Text style={{ fontSize: 13, color: "#7A8AAD" }}>EUR</Text>
                  </Text>
                  <Text style={{ color: "#7A8AAD", fontSize: 12 }}>{t.admin.invoices(invoices.length)}</Text>
                </View>
              </View>
            </Card>

            <Card>
              <H2>{t.admin.statementTitle}</H2>
              <Label>{t.invoices.label}</Label>
              <View style={PICKER_CONTAINER}>
                <Picker
                  selectedValue={labelId}
                  onValueChange={(v) => { setLabelId(String(v)); setExportFiles(null); }}
                  style={{ color: "#EAF0FF" }}
                  dropdownIconColor="#EAF0FF"
                >
                  <Picker.Item label={t.common.pleaseSelect} value="" />
                  {labels.filter((l) => l.active).map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              {selectedLabel ? (
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="person-outline" size={13} color="#7A8AAD" />
                    <P dim>{selectedLabel.recipient_name ?? "—"} · {selectedLabel.recipient_email ?? "—"}</P>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="receipt-outline" size={13} color="#7A8AAD" />
                    <P dim>{t.admin.receiptsInPeriod(statementInvoices.length)}</P>
                  </View>
                </View>
              ) : (
                <P dim>{t.admin.chooseLabel}</P>
              )}

              {exportFiles ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                    <P style={{ color: "#34D399" }}>{t.admin.exportReady}</P>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Btn
                        variant="secondary"
                        title={t.admin.shareExcel}
                        onPress={async () => {
                          try {
                            await Sharing.shareAsync(exportFiles.excel, {
                              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                              UTI: "com.microsoft.excel.xlsx",
                            });
                          } catch (e: any) {
                            Alert.alert(t.common.error, e?.message ?? "Unknown error");
                          }
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn
                        variant="secondary"
                        title={t.admin.sharePdf}
                        onPress={async () => {
                          try {
                            await Sharing.shareAsync(exportFiles.pdf, {
                              mimeType: "application/pdf",
                              UTI: "com.adobe.pdf",
                            });
                          } catch (e: any) {
                            Alert.alert(t.common.error, e?.message ?? "Unknown error");
                          }
                        }}
                      />
                    </View>
                  </View>
                  <Btn
                    variant="primary"
                    title={generate.isPending ? t.admin.exporting : t.admin.generateBtn}
                    onPress={() => generate.mutate()}
                    disabled={generate.isPending || !labelId}
                  />
                </View>
              ) : (
                <Btn
                  title={generate.isPending ? t.admin.exporting : t.admin.generateBtn}
                  onPress={() => generate.mutate()}
                  disabled={generate.isPending || !labelId}
                />
              )}

              <P dim>{t.admin.signedUrlNote}</P>
            </Card>

            {totals.eventTotals.length > 0 ? (
              <Card>
                <H2>{t.admin.eventTotals}</H2>
                {totals.eventTotals.slice(0, 8).map(([event, sum]) => (
                  <View key={event} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "#C9D4F2", fontSize: 14, flex: 1 }}>{event}</Text>
                    <Text style={{ color: "#EAF0FF", fontSize: 14, fontWeight: "700" }}>{sum.toFixed(2)} EUR</Text>
                  </View>
                ))}
                {totals.eventTotals.length > 8 ? <P dim>{t.admin.more(totals.eventTotals.length - 8)}</P> : null}
              </Card>
            ) : null}

            {totals.labelTotals.length > 0 ? (
              <SectionLabel title={t.admin.labelTotals} meta={t.admin.labels(totals.labelTotals.length)} />
            ) : null}
          </KeyboardAwareScrollView>
        }
        ListEmptyComponent={
          !invoicesQ.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 30, gap: 10 }}>
              <Ionicons name="bar-chart-outline" size={36} color="#2A3550" />
              <Text style={{ color: "#4A5672", fontSize: 14 }}>{t.admin.noInvoicesInPeriod}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const [label, sum] = item;
          return (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#C9D4F2", fontSize: 14, fontWeight: "700", flex: 1 }}>{label}</Text>
                <Text style={{ color: "#EAF0FF", fontSize: 18, fontWeight: "800" }}>
                  {sum.toFixed(2)} <Text style={{ fontSize: 12, color: "#7A8AAD" }}>EUR</Text>
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
