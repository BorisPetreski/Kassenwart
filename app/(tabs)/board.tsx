import React from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { Card, H1, H2, P, ui } from "../../src/ui/atoms";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Row = { member_id: string; member_name: string; balance: any };

function toNum(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export default function BoardScreen() {
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
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} />}
        contentContainerStyle={ui.content}
        ListHeaderComponent={<H1>Aushang</H1>}
        renderItem={({ item }) => {
          const b = toNum(item.balance);
          const status = b < 0 ? "Schuldet" : b > 0 ? "Bekommt" : "Ausgeglichen";
          const amount = Math.abs(b).toFixed(2);

          return (
            <Card>
              <H2>{item.member_name}</H2>
              <P>
                {status}: {amount} €
              </P>
              <P dim>Saldo (roh): {b.toFixed(2)} €</P>
            </Card>
          );
        }}
      />
    </View>
  );
}