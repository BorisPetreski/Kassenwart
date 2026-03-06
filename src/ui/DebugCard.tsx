import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { Card, H2, P } from "./atoms";

export function DebugCard() {
  const { orgId, role, isOrgLoading } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setUserId(data.user?.id ?? "");
    });
  }, []);

  return (
    <Card style={{ gap: 6 }}>
      <H2>DEBUG</H2>
      <P dim>Email: {email || "—"}</P>
      <P dim>UserId: {userId || "—"}</P>
      <P dim>OrgId: {orgId || "—"}</P>
      <P dim>Role: {role || "—"}</P>
      <P dim>OrgLoading: {String(isOrgLoading)}</P>
    </Card>
  );
}