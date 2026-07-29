import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server config: serves demo.html for local testing of the widget with hot reload.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
