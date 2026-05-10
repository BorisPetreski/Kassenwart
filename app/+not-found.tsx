import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { H1, P, ui } from "../src/ui/atoms";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Nicht gefunden", headerStyle: { backgroundColor: "#0B1220" }, headerTintColor: "#EAF0FF" }} />
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
        <View style={ui.content}>
          <H1>Seite nicht gefunden</H1>
          <Link href="/(tabs)/invoices">
            <P dim>Zurück zur App</P>
          </Link>
        </View>
      </View>
    </>
  );
}
