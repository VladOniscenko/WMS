import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@modules": path.resolve(__dirname, "./src/modules"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
