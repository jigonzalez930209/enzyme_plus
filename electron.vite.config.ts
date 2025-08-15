import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Configure Electron Main Process build
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // electron-vite accepts lib.entry for main
      lib: {
        entry: resolve(__dirname, "electron/main.ts"),
        formats: ["cjs"],
      },
      outDir: "dist-electron",
      emptyOutDir: false,
      sourcemap: true,
    },
  },

  // Configure Electron Preload scripts build
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Use rollupOptions.input for preload (it can include web assets)
      rollupOptions: {
        input: {
          preload: resolve(__dirname, "electron/preload.ts"),
        },
      },
      outDir: "dist-electron",
      emptyOutDir: false,
      sourcemap: true,
    },
  },

  // Configure the Renderer (Vite dev server + production build)
  renderer: {
    root: resolve(__dirname, "."),
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    plugins: [react(), tailwindcss()],
    // Use a different base when building for GitHub Pages so assets resolve under /enzyme_plus/
    // This is toggled by setting the environment variable GITHUB_PAGES=1
    base: process.env.GITHUB_PAGES
      ? `/${(process.env.GITHUB_REPOSITORY?.split("/")[1]) || "enzyme_plus"}/`
      : "/",
    build: {
      outDir: "dist",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
  },

  // Renderer stays configured through Vite's own vite.config.ts
});
