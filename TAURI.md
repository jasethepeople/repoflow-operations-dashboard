# RepoFlow as a Tauri 2 app

The Tauri scaffold lives in `src-tauri/` and wraps the unchanged Vite + React
frontend as a desktop (Windows/macOS/Linux) and mobile (Android/iOS) app.
Tauri renders the app in the operating system's own webview, so installers
are a few megabytes and there is no bundled browser.

## How the data works inside the app

The web build loads its evidence envelope from the same-origin
`/api/dashboard` handler. A Tauri webview has no same-origin server, so the
app build instead **bakes the envelope at build time**:

- `scripts/build-dashboard-data.ts` runs the *same* `handleDashboardRequest`
  from `server/api.ts` (same sanitizer, count checks, and evidence labels)
  and writes the response to `public/data/dashboard.json`.
- `src/data.ts` loads `/data/dashboard.json` when it detects the Tauri
  runtime (`__TAURI_INTERNALS__`) and `/api/dashboard` everywhere else. The
  payload shape and the client's envelope validation are identical either
  way; the file is git-ignored because it is generated.
- One disclosed difference: `boundary.apiBoundary.observedAt` in the baked
  envelope is the moment the build sealed the snapshot, and its note still
  describes the server-backed boundary that produced it. No status is
  promoted: repositories stay `public-evidence`, runtime health stays
  `unknown`, and nothing is labeled `verified-live`.

Verified 2026-10-23: the baked payload is identical to a live
`/api/dashboard` response apart from that one timestamp; `bun run test`
(1,382 assertions), `bun run typecheck`, and `bun run build` all pass, and
the built app serves the baked file correctly.

## What is NOT verified

A full `tauri build` has not run yet. This sandbox lacks the Linux
GTK/WebKit development libraries Tauri links against (`cargo check` stops
at `gdk-sys`), and an Android build needs the Android SDK/NDK. The Rust
side is the canonical Tauri 2 template (manifest validated, dependency
graph resolves); the first real build belongs on a developer machine or in
CI (below).

## Build on a computer

Prerequisites: Bun, the Rust toolchain (rustup), and the platform webview
dependencies Tauri's documentation lists for your OS.

```sh
bun install
bunx tauri dev     # live-reload desktop app against the Vite dev server
bunx tauri build   # installers under src-tauri/target/release/bundle/
```

## Build for Android

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
# Install the Android SDK + NDK (Android Studio's SDK Manager works) and set
# ANDROID_HOME and NDK_HOME as Tauri's mobile guide describes.
bunx tauri android init
bunx tauri android build
```

Release APKs/AABs need a signing keystore — the same one used for The Bet's
Play upload can sign this too.

## Or let GitHub Actions build it

Tauri's official `tauri-apps/tauri-action` builds desktop installers (and,
with the mobile targets configured, Android packages) on every tag or on
demand. Its workflow installs the Linux webview dependencies itself, which
sidesteps local toolchain setup entirely; the artifacts come back as
workflow downloads / release assets.

## Icon

`src-tauri/icons/icon.png` is a 1024×1024 placeholder drawn from the app's
own mark (amber brackets + status dot, accent `#F0B35B`). Regenerate the
full platform set from final artwork with:

```sh
bunx tauri icon src-tauri/icons/icon.png
```
