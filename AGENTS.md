# RepoFlow project guidance

- This is the standalone RepoFlow public-evidence operations dashboard, separate from Omni-Intel GraphRAG.
- Keep the first release static and credential-free. Inventory and homepage probes live in `public/data/`; selectors and evidence-boundary transformations live in `src/data.ts`.
- Never infer that public code, a declared homepage, or an HTTP response proves a deployment is live or healthy. Do not label anything `verified-live` without an authenticated or app-level health source.
- Preserve the distinction between `reachable`, `degraded`, `unknown`, `not-authorized`, and `verified-live`. Rate limiting is inconclusive, not a failed service.
- Keep private repositories, Actions, deployment, webhook, and runtime data as explicit integration seams until connected and verified.
- Use locally authored CSS and system font fallbacks; do not require a hosted font or CSS utility service for the preview.
- Run `bun run typecheck` and `bun run build` after changes, and inspect the rendered dashboard in the browser.
