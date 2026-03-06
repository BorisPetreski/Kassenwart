import React, { useMemo, useState } from "react";
import { Alert, FlatList, Share, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Btn, Card, H1, H2, Input, Label, P, ui } from "../../src/ui/atoms";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { DebugCard } from "../../src/ui/DebugCard";

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
  const isTreasurer = role === "treasurer";

  const membersQ = useQuery({ queryKey: ["members"], queryFn: fetchMembers, enabled: isTreasurer });
  const invitesQ = useQuery({ queryKey: ["invites"], queryFn: fetchInvites, enabled: isTreasurer });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      const e = normEmail(email);
      if (!n) throw new Error("Name fehlt.");
      if (!e.includes("@")) throw new Error("E-Mail ungültig.");

      const { data, error } = await supabase.rpc("invite_member", { p_name: n, p_email: e });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setName("");
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["invites"] });
      Alert.alert("OK", "Mitglied eingeladen.");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["invites"] });
      Alert.alert("OK", "Mitglied entfernt (archiviert + Zugriff entzogen).");
    },
    onError: (e: any) => Alert.alert("Fehler", e?.message ?? "Unknown error"),
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
          <H1>Mitglieder</H1>
          <Card>
            <P>Nur der Kassenwart kann Mitglieder verwalten.</P>
          </Card>
        </View>
      </View>
    );
  }

  const members = membersQ.data ?? [];
  const invites = invitesQ.data ?? [];

  const inviteInstructions = (email: string) => {
    return [
      "Du wurdest zur Kassenwart-App eingeladen.",
      "",
      `1) Sign up mit dieser E-Mail: ${email}`,
      "2) Danach einloggen. Du siehst dann: Rechnungen + Aushang.",
      "",
      "Wichtig: exakt diese E-Mail verwenden.",
    ].join("\n");
  };

  return (
    <View style={ui.screen}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
contentContainerStyle={ui.content}
ListHeaderComponent={
  <View style={{ gap: 12 }}>
    <DebugCard />
    <KeyboardAwareScrollView style={{ gap: 12 }}>
      <H1>Mitglieder</H1>
      <P dim>
        Org: {orgId ?? "—"} · Aktiv: {stats.active}/{stats.total} · Eingeloggt: {stats.joined}
      </P>

      <Card>
        <H2>Mitglied einladen</H2>
        <Label>Name</Label>
        <Input value={name} onChangeText={setName} placeholder="z.B. Max Mustermann" />
        <Label>E-Mail</Label>
        <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="max@email.de" />
        <Btn title={invite.isPending ? "Lade..." : "Einladen"} onPress={() => invite.mutate()} disabled={invite.isPending} />
        <P dim>Invite-by-email: Member kann später mit exakt dieser E-Mail sign up machen und joint automatisch.</P>
      </Card>

      <Card>
        <H2>Einladungen</H2>
        {invites.length === 0 ? <P dim>Keine Einladungen.</P> : null}
        {invites.slice(0, 6).map((i) => (
          <View key={i.id} style={{ gap: 4 }}>
            <P>
              {i.member_name ?? "—"} · {i.email}
            </P>
            <P dim>
              {i.accepted_at ? `Angenommen: ${new Date(i.accepted_at).toLocaleString()}` : `Offen seit: ${new Date(i.created_at).toLocaleString()}`}
            </P>
          </View>
        ))}
        {invites.length > 6 ? <P dim>+{invites.length - 6} weitere</P> : null}
      </Card>

      <H2>Liste</H2>
    </KeyboardAwareScrollView>
  </View>
}
        renderItem={({ item }) => {
          const joined = !!item.user_id;
          const status = !item.active ? "archiviert" : joined ? "aktiv · joined" : "aktiv · wartet";
          return (
            <Card>
              <H2>{item.name}</H2>
              <P>{item.email}</P>
              <P dim>Status: {status}</P>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="secondary"
                    title="Invite-Text teilen"
                    onPress={async () => {
                      try {
                        await Share.share({ message: inviteInstructions(item.email) });
                      } catch {}
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="danger"
                    title="Entfernen"
                    onPress={() => {
                      Alert.alert(
                        "Mitglied entfernen?",
                        "Das archiviert die Person und entzieht Zugriff zur Organisation.",
                        [
                          { text: "Abbrechen", style: "cancel" },
                          { text: "OK", style: "destructive", onPress: () => remove.mutate(item.id) },
                        ]
                      );
                    }}
                    disabled={remove.isPending}
                  />
                </View>
              </View>

              <P dim>Erstellt: {new Date(item.created_at).toLocaleString()}</P>
            </Card>
          );
        }}
      />
    </View>
  );
}