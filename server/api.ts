import { readFile } from "node:fs/promises";
import type {
  CheckState,
  DashboardApiResponse,
  EvidenceRecord,
  HomepageCheck,
  HomepageSnapshot,
  RepositoryInventory,
} from "../src/data.ts";

async function readJson<T>(path: URL): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function safeHomepage(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function checkState(check: HomepageCheck): CheckState {
  if (check.httpStatus === 429) return "unknown";
  if (check.httpStatus !== null && check.httpStatus >= 200 && check.httpStatus < 400) return "reachable";
  if (check.httpStatus !== null && check.httpStatus >= 400) return "degraded";
  return "unknown";
}

function evidence(status: EvidenceRecord["status"], source: string | null, observedAt: string | null, note: string): EvidenceRecord {
  return { status, source, observedAt, note };
}

function homepageNote(check: HomepageCheck): string {
  if (check.httpStatus === 429) return "HTTP 429 rate-limited the public probe; reachability is unknown.";
  if (check.httpStatus !== null && check.httpStatus >= 200 && check.httpStatus < 400) {
    return `HTTP ${check.httpStatus} at probe time; URL-level reachability only, not application health.`;
  }
  if (check.httpStatus !== null) return `HTTP ${check.httpStatus} at probe time; this does not establish current service health.`;
  return "No definitive HTTP response was recorded; reachability is unknown.";
}

async function dashboardPayload(): Promise<DashboardApiResponse> {
  const [inventory, sourceSnapshot] = await Promise.all([
    readJson<RepositoryInventory>(new URL("../public/data/inventory.json", import.meta.url)),
    readJson<HomepageSnapshot>(new URL("../public/data/homepage-checks.json", import.meta.url)),
  ]);

  if (inventory.repositoryCount !== inventory.repositories.length || sourceSnapshot.checkCount !== sourceSnapshot.checks.length) {
    throw new Error("The public-evidence snapshot failed its count checks.");
  }
  const owners = new Set(inventory.owners);
  if (inventory.repositories.some((repository) => repository.visibility !== "public" || !owners.has(repository.owner))) {
    throw new Error("The inventory contains a repository outside the declared public scope.");
  }

  const snapshot: HomepageSnapshot = {
    ...sourceSnapshot,
    checks: sourceSnapshot.checks.map((check) => ({ ...check, url: safeHomepage(check.url), status: checkState(check) })),
  };
  const checks = new Map(snapshot.checks.map((check) => [safeHomepage(check.url), check]));
  const repositorySource = inventory.source;
  const repositoryEvidence = evidence(
    "public-evidence",
    repositorySource,
    inventory.generatedAt,
    "Public GitHub repository metadata. This is not deployment or runtime-health evidence.",
  );
  const repositories = inventory.repositories.map((repository) => {
    const homepage = safeHomepage(repository.homepage);
    const check = homepage ? checks.get(homepage) : undefined;
    return {
      ...repository,
      homepage,
      repositoryEvidence,
      homepageCheck: check ?? null,
      homepageEvidence: homepage
        ? evidence(
            check ? check.status : "unknown",
            sourceSnapshot.source,
            check?.checkedAt ?? sourceSnapshot.generatedAt,
            check ? homepageNote(check) : "A homepage is declared, but no matching public probe result was recorded.",
          )
        : null,
    };
  });

  const now = new Date().toISOString();
  const unauthorized = (name: string) => evidence(
    "not-authorized",
    null,
    null,
    `${name} is not connected to RepoFlow; no private or authenticated data is included.`,
  );
  const boundary: DashboardApiResponse["boundary"] = {
    apiBoundary: evidence("configured", "RepoFlow server API", now, "Server-backed boundary serves the bundled public snapshot only."),
    repositoryInventory: evidence("public-evidence", repositorySource, inventory.generatedAt, "Unauthenticated public repository metadata."),
    homepageProbes: evidence("public-evidence", sourceSnapshot.source, sourceSnapshot.generatedAt, "Point-in-time public HTTP probes; not application-health checks."),
    privateRepositories: unauthorized("Private repository access"),
    actionsRuns: unauthorized("GitHub Actions runs and logs"),
    deploymentMetadata: unauthorized("Deployment metadata"),
    webhookDeliveryHistory: unauthorized("Webhook delivery history"),
    runtimeHealth: evidence("unknown", null, null, "No app-level or authenticated runtime-health integration is configured."),
    serviceVerification: evidence("unknown", null, null, "No service has been verified live by RepoFlow."),
  };

  return {
    boundary,
    inventory: { ...inventory, repositories: inventory.repositories.map((repository) => ({ ...repository, homepage: safeHomepage(repository.homepage) })) },
    snapshot,
    repositories,
  };
}

export async function handleDashboardRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/api/dashboard") return Response.json({ error: "Not found" }, { status: 404 });
  if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });

  try {
    return Response.json(await dashboardPayload(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "The bundled public-evidence snapshot is unavailable or invalid." }, { status: 503 });
  }
}
