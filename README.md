# RepoFlow Operations Dashboard

A single-page operations dashboard for the public GitHub portfolios of `jasethepeople` and `jasonclarkagain`. Its credential-free evidence snapshot contains 305 public repositories plus a point-in-time HTTP probe for each unique declared homepage; the same-origin server API preserves source and status labels for every claim.

## Run locally

Requirements: Bun 1.3+.

```sh
bun install
bun run dev
```

Open the Vite URL printed by the dev server. Build and type-check with:

```sh
bun run typecheck
bun run test
bun run build
bun run start
```

`bun run start` serves the production build and the same-origin `/api/dashboard` endpoint. Run `bun run build` first.

## Evidence and limitations

- `file public/data/inventory.json` is sanitized public repository metadata collected from GitHub's unauthenticated public-user-repositories API. It includes public repo identity, description, declared homepage, primary language, topics, stars/forks, fork/archive flags, and public timestamps.
- `file public/data/homepage-checks.json` contains one unauthenticated GET probe per unique HTTP(S) homepage. This is a one-time snapshot, not an ongoing monitor.
- HTTP 2xx and 3xx responses count as reachable at that moment; redirects still do not establish that an application works, is deployed as intended, or is healthy. Non-429 HTTP 4xx/5xx responses are shown as degraded URL responses; HTTP 429 is unknown because rate limiting makes the result inconclusive.
- `verified-live` remains zero until an app-level health source is configured. Private repositories, Actions runs/logs, deployment metadata, webhook delivery history, and runtime health remain `not-authorized` or `unknown`; the dashboard does not fabricate them.
- Operational candidates are metadata heuristics for human triage. Duplicate-family signals are conservative suffix-based name matches only, not code-similarity findings.
- Homepage query strings and fragments are omitted from the sanitized snapshot.

## Server boundary

`GET /api/dashboard` is the explicit server-backed boundary. In development and Vite preview, middleware in `file server/vite-middleware.ts` calls `file server/api.ts`; the production `file server.ts` serves both the built app and that same API handler. The client loads only the API envelope, not the JSON s directly.

The boundary labels GitHub repository fields `public-evidence`, homepage results `reachable`, `degraded`, or `unknown`, the API boundary `configured`, private and authenticated GitHub capabilities `not-authorized`, and runtime/service verification `unknown`. `verified-live` remains unused until a future app-level health source verifies it. An HTTP response or public repository record is never promoted into a deployment or health claim. The API has no credentials and returns only the bundled public snapshots.

## Structure

- `file src/App.tsx` — dashboard shell, views, filters, and evidence-status displays.
- `file src/data.ts` — typed API contract, safe client transformations, and selectors.
- `file src/styles.css` — locally authored responsive styles and status language.
- `file server/api.ts` — validated public-evidence envelope and explicit integration states.
- `file server/vite-middleware.ts` — serves the same API during development and Vite preview.
- `file server.ts` — production HTTP server for `dist/` and the API.
- `public/data/` — sanitized public inventory and homepage-check snapshot.
- `file public/manus-routes.json` — single-route dashboard manifest.
- `file app.config.ts` — project name and signal-mark metadata.