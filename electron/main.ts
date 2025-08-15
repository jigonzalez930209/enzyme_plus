import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const DEV_SERVER_URL =
  VITE_DEV_SERVER_URL || process.env["ELECTRON_RENDERER_URL"];
const isDev = !!DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.mjs");
  if (isDev) {
    console.log("[main] VITE_DEV_SERVER_URL =", VITE_DEV_SERVER_URL);
    console.log(
      "[main] ELECTRON_RENDERER_URL =",
      process.env["ELECTRON_RENDERER_URL"]
    );
    console.log("[main] __dirname =", __dirname);
    console.log(
      "[main] preload path =",
      preloadPath,
      "exists =",
      fs.existsSync(preloadPath)
    );
    console.log("[main] RENDERER_DIST =", RENDERER_DIST);
  }
  const indexCandidates = [
    path.join(RENDERER_DIST, "index.html"),
    // When dist is copied via extraResources
    path.join(process.resourcesPath, "dist", "index.html"),
    // Common electron-vite/electron-builder locations
    path.join(process.resourcesPath, "app", "dist", "index.html"),
    path.join(process.resourcesPath, "app.asar", "dist", "index.html"),
    path.join(process.resourcesPath, "app.asar.unpacked", "dist", "index.html"),
  ];
  const resolvedIndex = indexCandidates.find((p) => {
    const ok = fs.existsSync(p);
    if (isDev) console.log("[main] candidate index:", p, "exists =", ok);
    return ok;
  });
  const publicCandidates = [
    // Dev/public or built dist
    RENDERER_DIST,
    path.join(process.resourcesPath, "dist"),
    path.join(process.resourcesPath, "app", "dist"),
    path.join(process.resourcesPath, "app.asar", "dist"),
    path.join(process.resourcesPath, "app.asar.unpacked", "dist"),
  ];
  const resolvedPublic = publicCandidates.find((dir) => fs.existsSync(dir));
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: "hidden",
    // Use PNG icon for Linux/Ubuntu (SVG not supported for BrowserWindow icon)
    icon: resolvedPublic ? path.join(resolvedPublic, "logo.png") : path.join(process.env.VITE_PUBLIC || "", "logo.png"),
    webPreferences: {
      // Be explicit to avoid surprises
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });
  if (isDev) {
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.error("[main] did-fail-load:", { errorCode, errorDescription, validatedURL });
    });
    win.webContents.on("render-process-gone", (_event, details) => {
      console.error("[main] render-process-gone:", details);
    });
  }

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    // Open devTools in dev mode
    win.webContents.openDevTools();
  } else {
    const targetIndex = resolvedIndex || path.join(RENDERER_DIST, "index.html");
    if (isDev) console.log("[main] loading index:", targetIndex);
    win.loadFile(targetIndex).catch((err) => {
      if (isDev) console.error("[main] loadFile error:", err);
    });
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();

  ipcMain.on("minimize-window", () => {
    win?.minimize();
  });

  ipcMain.on("maximize-window", () => {
    if (win?.isMaximized()) {
      win?.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on("close-window", () => {
    win?.close();
  });
});
