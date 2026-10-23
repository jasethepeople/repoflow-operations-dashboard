// Bakes the /api/dashboard envelope into public/data/dashboard.json so the
// Tauri shell (which has no same-origin server) can load the identical
// payload from the bundled static files. The payload is produced by the
// same handler the Bun server, the Vite middleware, and the Vercel
// function all share — same sanitizer, same count checks, same labels.
// The only field that differs from a live response is
// boundary.apiBoundary.observedAt, which records when this build's
// snapshot was sealed.
import { writeFile } from "node:fs/promises";
import { handleDashboardRequest } from "../server/api.ts";

const response = await handleDashboardRequest(
  new Request("http://localhost/api/dashboard", { method: "GET" }),
);
if (!response.ok) {
  throw new Error(`Dashboard payload build failed with HTTP ${response.status}`);
}
const payload = await response.text();
const target = new URL("../public/data/dashboard.json", import.meta.url);
await writeFile(target, payload);
console.log(`Wrote ${target.pathname} (${payload.length} bytes)`);
