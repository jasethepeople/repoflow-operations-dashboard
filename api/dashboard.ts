import type { IncomingMessage, ServerResponse } from "node:http";
import { handleDashboardRequest } from "../server/api.ts";

// Vercel serverless entry point for GET /api/dashboard.
// Adapts Vercel's Node (req, res) calling convention to the same Web-standard
// handler the Bun production server and the Vite middleware already share.
// The handler reads the bundled snapshots from public/data/ relative to
// server/api.ts; vercel.json pins those files into this function's bundle
// via functions.includeFiles.
export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    const apiResponse = await handleDashboardRequest(new Request(url, { method: request.method ?? "GET" }));
    response.statusCode = apiResponse.status;
    apiResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(await apiResponse.text());
  } catch {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "API boundary failed." }));
  }
}
