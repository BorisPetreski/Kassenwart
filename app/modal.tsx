import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Btn, H1, ui } from "../src/ui/atoms";

export default function ModalScreen() {
  const router = useRouter();
  return (
    <View style={[ui.screen, { justifyContent: "center" }]}>
      <View style={ui.content}>
        <H1>Modal</H1>
        <Btn variant="secondary" title="Schließen" onPress={() => router.back()} />
      </View>
      <StatusBar style="light" />
    </View>
  );
}
