import React, { useMemo, useState } from "react";
import { Alert, FlatList, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useT } from "../../src/i18n/LanguageProvider";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H2, Input, Label, P, SectionLabel, ui } from "../../src/ui/atoms";

type MemberRow = {
  id: string;
  name: string;
  email: string;
  user_id: string | null;
  active: boolean;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  member_name: string | null;
  created_at: string;
  accepted_at: string | null;
};

function normEmail(v: string) {
  return v.trim().toLowerCase();
}

async function fetchMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("members")
    .select("id,name,email,user_id,active,created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchInvites(): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from("org_invitations")
    .select("id,email,member_name,created_at,accepted_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any;
}

export default function MembersScreen() {
  const qc = useQueryClient();
  const { role, orgId } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isTreasurer = role === "treasurer";

  const membersQ = useQuery({ queryKey: ["members"], queryFn: fetchMembers, enabled: isTreasurer });
  const invitesQ = useQuery({ queryKey: ["invites"], queryFn: fetchInvites, enabled: isTreasurer });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      const e = normEmail(email);
      if (!n) throw new Error(t.members.nameRequired);
      if (!e.includes("@")) throw new Error(t.members.emailInvalid);
      const { data, error } = await supabase.rpc("invite_member", { p_name: n, p_email: e });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setName(""); setEmail("");
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["invites"] });
      Alert.alert(t.common.ok, t.members.inviteSuccess);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["invites"] });
      Alert.alert(t.common.ok, t.members.removeSuccess);
    },
    onError: (e: any) => Alert.alert(t.common.error, e?.message ?? "Unknown error"),
  });

  const stats = useMemo(() => {
    const ms = membersQ.data ?? [];
    const active = ms.filter((m) => m.active).length;
    const joined = ms.filter((m) => !!m.user_id && m.active).length;
    return { total: ms.length, active, joined };
  }, [membersQ.data]);

  if (!isTreasurer) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <Card><P>{t.members.noAccess}</P></Card>
        </View>
      </View>
    );
  }

  const members = membersQ.data ?? [];
  const invites = invitesQ.data ?? [];

  return (
    <View style={ui.screen}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[ui.content, { paddingBottom: 56 + insets.bottom + 16 }]}
        ListHeaderComponent={
          <KeyboardAwareScrollView style={{ gap: 14 }} enableAutomaticScroll extraScrollHeight={20} keyboardShouldPersistTaps="handled">
            <P dim>{t.members.orgStats(orgId ?? "—", stats.active, stats.total, stats.joined)}</P>

            <Card>
              <H2>{t.members.inviteTitle}</H2>
              <Label>{t.members.name}</Label>
              <Input value={name} onChangeText={setName} placeholder={t.members.namePlaceholder} />
              <Label>{t.members.email}</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t.members.emailPlaceholder}
              />
              <Btn
                title={invite.isPending ? t.members.inviting : t.members.invite}
                onPress={() => invite.mutate()}
                disabled={invite.isPending}
              />
              <P dim>{t.members.inviteHint}</P>
            </Card>

            <Card>
              <H2>{t.members.invitesTitle}</H2>
              {invites.length === 0 ? <P dim>{t.members.noInvites}</P> : null}
              {invites.slice(0, 6).map((i) => (
                <View key={i.id} style={{ gap: 4 }}>
                  <P>{i.member_name ?? "—"} · {i.email}</P>
                  <P dim>
                    {i.accepted_at
                      ? t.members.accepted(new Date(i.accepted_at).toLocaleString())
                      : t.members.pending(new Date(i.created_at).toLocaleString())}
                  </P>
                </View>
              ))}
              {invites.length > 6 ? <P dim>{t.members.more(invites.length - 6)}</P> : null}
            </Card>

            <SectionLabel title={t.members.list} />
          </KeyboardAwareScrollView>
        }
        ListEmptyComponent={
          !membersQ.isFetching ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <P dim>{t.common.noEntries}</P>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const joined = !!item.user_id;
          const statusLabel = !item.active
            ? t.members.statusArchived
            : joined
            ? t.members.statusActive
            : t.members.statusWaiting;

          return (
            <Card>
              <H2>{item.name}</H2>
              <P>{item.email}</P>
              <P dim>Status: {statusLabel}</P>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="secondary"
                    title={t.members.shareInvite}
                    onPress={async () => {
                      try {
                        await Share.share({ message: t.members.inviteText(item.email) });
                      } catch {}
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="danger"
                    title={t.members.remove}
                    onPress={() => {
                      Alert.alert(t.members.removeTitle, t.members.removeBody, [
                        { text: t.common.cancel, style: "cancel" },
                        { text: t.common.ok, style: "destructive", onPress: () => remove.mutate(item.id) },
                      ]);
                    }}
                    disabled={remove.isPending}
                  />
                </View>
              </View>

              <P dim>{t.members.createdAt(new Date(item.created_at).toLocaleString())}</P>
            </Card>
          );
        }}
      />
    </View>
  );
}
