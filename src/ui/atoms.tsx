import React from "react";
import { Pressable, StyleSheet, Text, TextInput, TextProps, View, ViewProps, TextInputProps } from "react-native";
import type { Translations } from "../i18n/translations";

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={ui.h1}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: TextProps["style"] }) {
  return <Text style={[ui.h2, style]}>{children}</Text>;
}
export function P({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: TextProps["style"] }) {
  return <Text style={[ui.p, dim ? ui.dim : null, style]}>{children}</Text>;
}

export function Card({ children, style }: ViewProps) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={ui.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} style={[ui.input, props.style]} placeholderTextColor="#4C5F7A" />;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.09)", marginVertical: 2 }} />;
}

// Section header that separates form area from list — extra top spacing so it reads as a new group
export function SectionLabel({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
      <Text style={{ color: "#3D5070", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
        {title}
      </Text>
      {meta ? <Text style={{ color: "#3D5070", fontSize: 11, fontWeight: "500" }}>{meta}</Text> : null}
    </View>
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: "rgba(59,130,246,0.15)",  text: "#93C5FD" },
  reviewed:  { bg: "rgba(245,158,11,0.15)",  text: "#FCD34D" },
  approved:  { bg: "rgba(16,185,129,0.15)",  text: "#6EE7B7" },
  paid:      { bg: "rgba(99,102,241,0.15)",  text: "#A5B4FC" },
  rejected:  { bg: "rgba(239,68,68,0.15)",   text: "#FCA5A5" },
};

export function StatusBadge({ status, t }: { status: string; t?: Translations }) {
  const colors = STATUS_COLORS[status] ?? { bg: "rgba(255,255,255,0.08)", text: "#C9D4F2" };
  const label = t?.status[status as keyof Translations["status"]] ?? status;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export function AmountText({ amount, currency = "EUR" }: { amount: number; currency?: string }) {
  return (
    <Text style={ui.amount}>
      {amount.toFixed(2)}{" "}
      <Text style={ui.amountCurrency}>{currency}</Text>
    </Text>
  );
}

export function Btn({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        ui.btn,
        variant === "primary"   ? ui.btnPrimary   : null,
        variant === "secondary" ? ui.btnSecondary : null,
        variant === "danger"    ? ui.btnDanger    : null,
        disabled ? ui.btnDisabled : null,
        pressed && !disabled ? { opacity: 0.78 } : null,
      ]}
    >
      <Text style={[ui.btnText, variant === "secondary" ? ui.btnTextSecondary : null, variant === "danger" ? ui.btnTextDanger : null]}>
        {title}
      </Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#080F1C" },
  content: { padding: 16, gap: 12 },

  h1: { fontSize: 24, fontWeight: "900", color: "#EAF0FF", letterSpacing: -0.4 },
  h2: { fontSize: 13, fontWeight: "700", color: "#C9D4F2", letterSpacing: 0.1 },
  p:  { fontSize: 14, color: "#C9D4F2", lineHeight: 20 },
  dim: { color: "#5A6D8C", fontSize: 13 },

  amount:         { fontSize: 20, fontWeight: "800", color: "#EAF0FF", letterSpacing: -0.3 },
  amountCurrency: { fontSize: 13, fontWeight: "600", color: "#7A8AAD" },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0D1628",
    borderRadius: 16,
    padding: 16,
    gap: 16,
    margin: 8,
  },

  label: { fontSize: 11, fontWeight: "700", color: "#4C6D96", letterSpacing: 0.7, textTransform: "uppercase" },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#EAF0FF",
    backgroundColor: "rgba(255,255,255,0.04)",
    fontSize: 15,
  },

  btn:            { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", minHeight: 44 },
  btnPrimary:     { backgroundColor: "#2563EB" },
  btnSecondary:   { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.11)" },
  btnDanger:      { backgroundColor: "rgba(127,17,17,0.8)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  btnDisabled:    { opacity: 0.4 },

  btnText:         { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnTextSecondary:{ color: "#B0BECC" },
  btnTextDanger:   { color: "#FCA5A5" },
});
