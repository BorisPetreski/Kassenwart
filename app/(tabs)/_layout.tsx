import React from "react";
import { Tabs } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";
import { HeaderLogout } from "../../src/ui/HeaderLogout";

export default function TabsLayout() {
  const { role } = useAuth();
  const isTreasurer = role === "treasurer";

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#0B1220" },
        headerTintColor: "#EAF0FF",
        headerTitleStyle: { fontWeight: "900" },
        headerRight: () => <HeaderLogout />,

        tabBarStyle: {
          backgroundColor: "#0B1220",
          borderTopColor: "rgba(255,255,255,0.12)",
        },
        tabBarActiveTintColor: "#EAF0FF",
        tabBarInactiveTintColor: "#91A0C5",
      }}
    >
      <Tabs.Screen name="invoices" options={{ title: "Rechnungen" }} />
      <Tabs.Screen name="board" options={{ title: "Aushang" }} />

      {isTreasurer ? (
        <>
          <Tabs.Screen name="admin" options={{ title: "Übersicht" }} />
          <Tabs.Screen name="members" options={{ title: "Mitglieder" }} />
          <Tabs.Screen name="settings" options={{ title: "Labels" }} />
          <Tabs.Screen name="events" options={{ title: "Events" }} />
          <Tabs.Screen name="ledger" options={{ title: "Buchungen" }} />
        </>
      ) : null}
    </Tabs>
  );
}