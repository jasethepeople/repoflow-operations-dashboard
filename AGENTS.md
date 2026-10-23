# RepoFlow project guidance

- This is the standalone RepoFlow public-evidence operations dashboard, separate from Omni-Intel GraphRAG.
- The first release remains credential-free: bundled snapshots live in `public/data/`, `server/api.ts` validates and labels them, and `src/data.ts` consumes only the typed `/api/dashboard` response.
- Never infer that public code, a declared homepage, or an HTTP response proves a deployment is live or healthy. Do not label anything `verified-live` without an authenticated or app-level health source.
- Preserve the distinction between `public-evidence`, `configured`, `reachable`, `degraded`, `unknown`, `not-authorized`, and `verified-live`. Rate limiting is inconclusive, not a failed service.
- `configured` describes the RepoFlow API boundary only. Preserve `public-evidence` on repository metadata, and never promote public metadata or HTTP reachability into `verified-live`.
- Keep private repositories, Actions, deployment, webhook, and runtime data as explicit integration seams until connected and verified.
- Use locally authored CSS and system font fallbacks; do not require a hosted font or CSS utility service for the preview.
- Run `bun run test`, `bun run typecheck`, and `bun run build` after changes, and inspect the rendered dashboard in the browser.
