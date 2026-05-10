import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../src/i18n/LanguageProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { HeaderLogout } from "../../src/ui/HeaderLogout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={22} color={color} />
  );
}

const HIDDEN_TAB = { href: null } as const;

export default function TabsLayout() {
  const { role } = useAuth();
  const { t } = useT();
  const isTreasurer = role === "treasurer";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#080F1C" },
        headerShadowVisible: false,
        headerTintColor: "#EAF0FF",
        headerTitleStyle: { fontWeight: "900", fontSize: 17 },
        headerRight: () => <HeaderLogout />,
        tabBarStyle: {
          backgroundColor: "#0B1220",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },
        tabBarActiveTintColor: "#4D8AFF",
        tabBarInactiveTintColor: "#4A5672",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="invoices"
        options={{ title: t.invoices.title, tabBarIcon: tabIcon("receipt-outline", "receipt") }}
      />
      <Tabs.Screen
        name="board"
        options={{ title: t.board.title, tabBarIcon: tabIcon("people-outline", "people") }}
      />
      <Tabs.Screen
        name="admin"
        options={isTreasurer ? { title: t.admin.title, tabBarIcon: tabIcon("bar-chart-outline", "bar-chart") } : HIDDEN_TAB}
      />
      <Tabs.Screen
        name="members"
        options={isTreasurer ? { title: t.members.title, tabBarIcon: tabIcon("person-add-outline", "person-add") } : HIDDEN_TAB}
      />
      
      <Tabs.Screen
        name="events"
        options={isTreasurer ? { title: t.events.title, tabBarIcon: tabIcon("calendar-outline", "calendar") } : HIDDEN_TAB}
      />
      <Tabs.Screen
        name="ledger"
        options={isTreasurer ? { title: t.ledger.title, tabBarIcon: tabIcon("book-outline", "book") } : HIDDEN_TAB}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t.language.tab, tabBarIcon: tabIcon("settings-outline", "settings") }}
      />
    </Tabs>
  );
}
