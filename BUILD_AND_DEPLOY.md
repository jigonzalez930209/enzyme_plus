# Build and Deploy Guide

This project ships as an Electron desktop app for Linux, Windows, and macOS.

Prerequisites
- Node.js 18+ and pnpm installed
- Platform toolchains (Windows: NSIS/Visual Studio Build Tools, macOS: Xcode + signing if applicable, Linux: build-essential, rpm/snapcraft if packaging those formats)
- For local publishing to GitHub Releases: export GH_TOKEN with a Personal Access Token (repo scope). GitHub Actions provides a token automatically.

Install dependencies
- `pnpm install`

Development
- Start dev (Electron + Vite): `pnpm dev`
- Preview packaged app locally (no publish): use platform scripts below.

Local desktop packaging (no publishing)
- Build renderer (type-check + bundle): `pnpm run build`
- Package per platform:
  - Windows: `pnpm run build:win`
  - macOS: `pnpm run build:mac`
  - Linux: `pnpm run build:linux`
- Create an unpacked directory (for inspection): `pnpm run build:unpack`

Notes
- electron-builder configuration lives in `package.json` under the `build` key.
- Local scripts above do not pass `--publish always`, so they will NOT publish artifacts.
- If you ever need to force no publishing explicitly, append `--publish never` to the electron-builder command.

Release builds (publish to GitHub Releases)
- CI: Pushing to `main` triggers `.github/workflows/release.yml`, which:
  - installs dependencies with pnpm,
  - builds the app, and
  - runs electron-builder on macOS, Windows, and Linux with `--publish always`.
- Local (optional): You can publish from your machine by running electron-builder with `--publish always` and exporting `GH_TOKEN` first.
  - Examples: `./node_modules/.bin/electron-builder --mac --publish always`, `--win`, or `--linux`

GitHub Pages (static site)
- Build for Pages: `pnpm run build:gh-pages` (sets a Pages-friendly base and outputs to `dist/`).
- Automatic deployment:
  - Workflow: `.github/workflows/pages.yml`
  - Triggers on push to `main` or via manual run (workflow_dispatch).
  - Uploads `dist/` and publishes to GitHub Pages.
- First-time setup: In your repository Settings → Pages, set Source to "GitHub Actions" if not already.
- Resulting URL: `https://<username>.github.io/<repo>/` (e.g., `https://jigonzalez930209.github.io/enzyme_plus/`).
- Note: If you add client-side routing in the future, also generate a `404.html` that mirrors `index.html` for SPA fallback.

Troubleshooting
- Error: `Cannot read properties of null (reading 'provider')` during electron-builder
  - Cause: a publish provider is configured in `package.json > build.publish`, but your command/environment is attempting to publish without proper credentials.
  - Fix: use the local packaging scripts (`pnpm run build:win|mac|linux`) or add `--publish never` when running electron-builder locally.
  - Alternative: temporarily remove `build.publish` for local-only packaging and rely on CI to publish with `--publish always`.
- Missing metadata warnings (description/author/repository)
  - Add/complete these fields in `package.json` to improve release artifacts.
- Vite large chunk size warnings
  - Consider code splitting via Rollup `manualChunks` or dynamic imports.

Artifacts
- Windows: NSIS and MSI installers named like `enzyme_plus-Windows-<version>-Setup-<arch>.<ext>`
- macOS: DMG/ZIP/PKG named like `enzyme_plus-Mac-<version>-Setup.<ext>`
- Linux: AppImage and DEB named like `enzyme_plus-Linux-<version>-Setup.<ext>`

Signing (optional but recommended for production)
- Windows: Set up a code signing certificate and configure `win.certificateSubjectName` or environment variables supported by electron-builder.
- macOS: Configure Apple Developer ID Application certificate and notarization. Refer to electron-builder docs.
