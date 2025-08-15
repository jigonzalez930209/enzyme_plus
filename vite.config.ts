import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Para GitHub Pages: servir bajo "/enzyme_plus/" cuando GITHUB_PAGES=true en build de producción.
  // Ajusta el nombre si el repo cambia.
  base:
    // Prioriza VITE_BASE si está definido (útil en CI para calcular automáticamente el nombre del repo)
    process.env.VITE_BASE ??
    (mode === "production" && process.env.GITHUB_PAGES === "true"
      ? "/enzyme_plus/"
      : "/"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [react(), tailwindcss()],
}));
