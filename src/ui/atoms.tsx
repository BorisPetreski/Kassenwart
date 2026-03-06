import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewProps, TextInputProps } from "react-native";

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={ui.h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={ui.h2}>{children}</Text>;
}
export function P({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <Text style={[ui.p, dim ? ui.dim : null]}>{children}</Text>;
}

export function Card({ children, style }: ViewProps) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={ui.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} style={[ui.input, props.style]} placeholderTextColor="#7A8597" />;
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
      style={[
        ui.btn,
        variant === "primary" ? ui.btnPrimary : null,
        variant === "secondary" ? ui.btnSecondary : null,
        variant === "danger" ? ui.btnDanger : null,
        disabled ? ui.btnDisabled : null,
      ]}
    >
      <Text style={[ui.btnText, variant === "secondary" ? ui.btnTextSecondary : null]}>{title}</Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1220" },
  content: { padding: 16, gap: 12 },

  h1: { fontSize: 22, fontWeight: "900", color: "#EAF0FF" },
  h2: { fontSize: 16, fontWeight: "900", color: "#EAF0FF" },
  p: { fontSize: 13, color: "#C9D4F2", lineHeight: 18 },
  dim: { color: "#91A0C5" },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },

  label: { fontSize: 12, fontWeight: "800", color: "#BFD0FF" },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#EAF0FF",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  btn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: "#2E6BFF" },
  btnSecondary: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  btnDanger: { backgroundColor: "#B42318" },
  btnDisabled: { opacity: 0.6 },

  btnText: { color: "#FFFFFF", fontWeight: "800" },
  btnTextSecondary: { color: "#EAF0FF" },
});