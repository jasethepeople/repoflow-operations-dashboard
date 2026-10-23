import type { Connect } from "vite";
import { handleDashboardRequest } from "./api.ts";

export const apiBoundaryMiddleware: Connect.NextHandleFunction = (request, response, next) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return next();

  void handleDashboardRequest(new Request(url, { method: request.method ?? "GET" }))
    .then(async (apiResponse) => {
      response.statusCode = apiResponse.status;
      apiResponse.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(await apiResponse.text());
    })
    .catch((error: unknown) => next(error instanceof Error ? error : new Error("API boundary failed.")));
};
