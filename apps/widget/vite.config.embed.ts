import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production embed build: a single self-mounting IIFE bundle (window.MpeChatbot),
// meant to be dropped onto the WordPress/Divi site via a <script> tag. CSS is
// inlined into the JS (imported with ?inline) and injected into a Shadow DOM at
// runtime, so there is no separate stylesheet to link and no collision with the
// host page's styles.
export default defineConfig({
  plugins: [react()],
  // Vite only auto-replaces process.env.NODE_ENV in app builds — library-mode output
  // is normally expected to pass through another bundler that does it instead. This
  // bundle is loaded directly by a browser via <script>, so nothing else will ever do
  // that replacement; without it, React's own `process.env.NODE_ENV` checks throw
  // "process is not defined" as soon as the script runs on a real page.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    global: "globalThis",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/embed.tsx",
      name: "MpeChatbot",
      formats: ["iife"],
      fileName: () => "mpe-chatbot-widget.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
