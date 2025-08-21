import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { replit } from "@replit/vite-plugin-cartographer";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), replit()],
  root: "client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "client/src"),
      "@shared": resolve(__dirname, "shared"),
    },
  },
});