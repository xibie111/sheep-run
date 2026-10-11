import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sheeprun.game",
  appName: "小羊快跑",
  webDir: "dist",
  android: { backgroundColor: "#73b95b" },
  plugins: {
    // MainActivity fills the display and passes insets to UI as CSS variables.
    SystemBars: { hidden: true, insetsHandling: "disable" },
  },
};

export default config;

