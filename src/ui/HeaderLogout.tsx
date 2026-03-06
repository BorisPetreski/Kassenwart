import React from "react";
import { Alert, Pressable, Text } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers/AuthProvider";

export function HeaderLogout() {
  const { signOut } = useAuth();
  const qc = useQueryClient();

  return (
    <Pressable
      onPress={() => {
        Alert.alert("Logout?", "Willst du dich wirklich ausloggen?", [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: async () => {
              try {
                await signOut();
                qc.clear(); // ✅ important: remove cached org data
              } catch (e: any) {
                Alert.alert("Fehler", e?.message ?? "Logout fehlgeschlagen");
              }
            },
          },
        ]);
      }}
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <Text style={{ color: "#EAF0FF", fontWeight: "900" }}>Logout</Text>
    </Pressable>
  );
}