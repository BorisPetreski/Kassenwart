import React from "react";
import { Alert, Pressable, Text } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "../i18n/LanguageProvider";
import { useAuth } from "../providers/AuthProvider";

export function HeaderLogout() {
  const { signOut } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();

  return (
    <Pressable
      onPress={() => {
        Alert.alert(t.auth.logoutTitle, t.auth.logoutConfirm, [
          { text: t.common.cancel, style: "cancel" },
          {
            text: t.auth.logout,
            style: "destructive",
            onPress: async () => {
              try {
                await signOut();
                qc.clear();
              } catch (e: any) {
                Alert.alert(t.common.error, e?.message ?? t.auth.logoutError);
              }
            },
          },
        ]);
      }}
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <Text style={{ color: "#EAF0FF", fontWeight: "900" }}>{t.auth.logout}</Text>
    </Pressable>
  );
}
