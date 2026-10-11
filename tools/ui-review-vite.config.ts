import { defineConfig } from "vite";

// Freeze a browser QA session while the separately authorized viewport chat works.
export default defineConfig({ base: "./", server: { hmr: false, watch: null } });
