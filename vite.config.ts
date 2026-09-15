import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Tauri expects a fixed port and does not want to fall back to another one.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Produce a smaller, modern bundle.
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          state: ["zustand"],
        },
      },
    },
  },
});