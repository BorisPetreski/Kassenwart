import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { Card, ui } from "../../src/ui/atoms";

type Row = { member_id: string; member_name: string; balance: any };

function toNum(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export default function BoardScreen() {
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const q = useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_board");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <View style={ui.screen}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(x) => x.member_id}
        refreshControl={
          <RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor="#4D8AFF" />
        }
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" }} />
                <Text style={{ color: "#7A8AAD", fontSize: 12 }}>{t.board.receives}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F87171" }} />
                <Text style={{ color: "#7A8AAD", fontSize: 12 }}>{t.board.owes}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4A5672" }} />
                <Text style={{ color: "#7A8AAD", fontSize: 12 }}>{t.board.balanced}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          !q.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Ionicons name="people-outline" size={40} color="#2A3550" />
              <Text style={{ color: "#4A5672", fontSize: 14 }}>{t.board.noEntries}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const b = toNum(item.balance);
          const isPositive = b > 0;
          const isNegative = b < 0;
          const isNeutral = b === 0;

          const accentColor = isPositive ? "#34D399" : isNegative ? "#F87171" : "#4A5672";
          const bgColor = isPositive
            ? "rgba(52,211,153,0.06)"
            : isNegative
            ? "rgba(248,113,113,0.06)"
            : "rgba(255,255,255,0.04)";

          const statusLabel = isNegative ? t.board.owes : isPositive ? t.board.receives : t.board.balanced;
          const icon = isNegative ? "arrow-up-outline" : isPositive ? "arrow-down-outline" : "remove-outline";

          return (
            <Card style={{ backgroundColor: bgColor, borderColor: `${accentColor}22` }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#EAF0FF" }}>
                    {item.member_name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name={icon as any} size={12} color={accentColor} />
                    <Text style={{ color: accentColor, fontSize: 12, fontWeight: "600" }}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: accentColor }}>
                    {Math.abs(b).toFixed(2)} €
                  </Text>
                  {!isNeutral ? (
                    <Text style={{ color: "#4A5672", fontSize: 11 }}>
                      {t.board.balance}: {b.toFixed(2)} €
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
