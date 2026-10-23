# RepoFlow Operations Dashboard

A single-page operations dashboard for the public GitHub portfolios of `jasethepeople` and `jasonclarkagain`. The initial release is a static, credential-free evidence slice: 305 public repositories plus a point-in-time HTTP snapshot of the unique homepage URLs declared on those repositories.

## Run locally

Requirements: Bun 1.3+.

```sh
bun install
bun run dev
```

Open the Vite URL printed by the dev server. Build and type-check with:

```sh
bun run typecheck
bun run build
```

## Evidence and limitations

- `public/data/inventory.json` is sanitized public repository metadata collected from GitHub's unauthenticated public-user-repositories API. It includes public repo identity, description, declared homepage, primary language, topics, stars/forks, fork/archive flags, and public timestamps.
- `public/data/homepage-checks.json` contains one unauthenticated GET probe per unique HTTP(S) homepage. This is a one-time snapshot, not an ongoing monitor.
- HTTP 2xx and 3xx responses count as reachable at that moment; redirects still do not establish that an application works, is deployed as intended, or is healthy. Non-429 HTTP 4xx/5xx responses are shown as degraded URL responses; HTTP 429 is unknown because rate limiting makes the result inconclusive.
- `verified-live` remains zero until an app-level health source is configured. Private repositories, Actions runs/logs, deployment metadata, webhook delivery history, and runtime health remain `not-authorized` or `unknown`; the dashboard does not fabricate them.
- Operational candidates are metadata heuristics for human triage. Duplicate-family signals are conservative suffix-based name matches only, not code-similarity findings.
- Homepage query strings and fragments are omitted from the sanitized snapshot.

## Structure

- `src/App.tsx` — dashboard shell, views, filters, and table layout.
- `src/data.ts` — typed static-data loading and client-side selectors.
- `src/styles.css` — locally authored responsive styles and status language.
- `public/data/` — public inventory and homepage-check snapshot.
- `public/manus-routes.json` — single-route dashboard manifest.
- `app.config.ts` — project name and signal-mark metadata.

The project intentionally avoids credentials and a backend in this first slice. Later integrations should add a server-backed boundary and preserve the evidence labels rather than silently upgrading public metadata into operational facts.
