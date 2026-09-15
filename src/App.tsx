/**
 * Application shell.
 *
 * Chooses between the widget surface and the settings surface, and makes sure
 * the settings store is hydrated before either renders real content.
 */

import { useEffect } from "react";
import ClockWidget from "./components/ClockWidget";
import SettingsApp from "./settings/SettingsApp";
import { useSettings } from "./services/settingsStore";
import { attachNativeListeners } from "./services/trayEvents";

interface AppProps {
  surface: "widget" | "settings";
}

export default function App({ surface }: AppProps) {
  const hydrate = useSettings((s) => s.hydrate);
  const loaded = useSettings((s) => s.loaded);

  useEffect(() => {
    void hydrate();
    const cleanup = attachNativeListeners(useSettings);
    return () => {
      void cleanup.then((fn) => fn());
    };
  }, [hydrate]);

  if (!loaded) {
    return null; // Avoid a flash of default settings before hydration.
  }

  return surface === "settings" ? <SettingsApp /> : <ClockWidget />;
}