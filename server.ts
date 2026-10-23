import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleDashboardRequest } from "./server/api.ts";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const distRoot = resolve(projectRoot, "dist");
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function sendResponse(response: Response, outgoing: import("node:http").ServerResponse): void {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, key) => outgoing.setHeader(key, value));
  void response.text().then((body) => outgoing.end(body));
}

async function handleRequest(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const apiResponse = await handleDashboardRequest(new Request(url, { method: request.method ?? "GET" }));
    sendResponse(apiResponse, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendResponse(new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }), response);
    return;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    sendResponse(new Response("Not found", { status: 404 }), response);
    return;
  }
  const relativePath = decodedPath.replace(/^\/+/, "") || "index.html";
  let filePath = resolve(distRoot, relativePath);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    sendResponse(new Response("Forbidden", { status: 403 }), response);
    return;
  }

  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    if (extname(relativePath)) {
      sendResponse(new Response("Not found", { status: 404 }), response);
      return;
    }
    filePath = resolve(distRoot, "index.html");
    try {
      content = await readFile(filePath);
    } catch {
      sendResponse(new Response("Production build not found", { status: 503 }), response);
      return;
    }
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", mimeTypes[extname(filePath)] ?? "application/octet-stream");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", filePath.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
  response.end(request.method === "HEAD" ? undefined : content);
}

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "0.0.0.0";

createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    response.end("Internal server error");
  });
}).listen(port, host, () => {
  console.log(`RepoFlow server listening on ${host}:${port}`);
});
