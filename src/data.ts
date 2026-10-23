export type EvidenceStatus = "public-evidence" | "configured" | "reachable" | "verified-live" | "degraded" | "unknown" | "not-authorized";
export type CheckState = "reachable" | "degraded" | "unknown";
export type DisplayState = EvidenceStatus;

export interface RepositoryRecord {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  homepage: string;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  url: string;
  visibility: "public";
}

export interface RepositoryInventory {
  source: string;
  sourceUrl: string;
  generatedAt: string;
  owners: string[];
  repositoryCount: number;
  repositories: RepositoryRecord[];
}

export interface HomepageCheck {
  url: string;
  status: CheckState;
  httpStatus: number | null;
  checkedAt: string;
  responseMs: number | null;
  finalHost: string;
}

export interface HomepageSnapshot {
  source: string;
  generatedAt: string;
  interpretation: string;
  checkCount: number;
  checks: HomepageCheck[];
}

export interface EvidenceRecord {
  status: EvidenceStatus;
  source: string | null;
  observedAt: string | null;
  note: string;
}

export interface DashboardBoundary {
  apiBoundary: EvidenceRecord;
  repositoryInventory: EvidenceRecord;
  homepageProbes: EvidenceRecord;
  privateRepositories: EvidenceRecord;
  actionsRuns: EvidenceRecord;
  deploymentMetadata: EvidenceRecord;
  webhookDeliveryHistory: EvidenceRecord;
  runtimeHealth: EvidenceRecord;
  serviceVerification: EvidenceRecord;
}

export interface DashboardApiRepository extends RepositoryRecord {
  repositoryEvidence: EvidenceRecord;
  homepageEvidence: EvidenceRecord | null;
  homepageCheck: HomepageCheck | null;
}

export interface DashboardApiResponse {
  boundary: DashboardBoundary;
  inventory: RepositoryInventory;
  snapshot: HomepageSnapshot;
  repositories: DashboardApiRepository[];
}

export interface DashboardRepository extends DashboardApiRepository {
  safeHomepage: string;
  displayState: CheckState | "no-homepage";
  operationalCandidate: boolean;
  candidateEvidence: "declared-homepage" | "metadata-match" | null;
  familyKey: string;
}

export interface DashboardData {
  boundary: DashboardBoundary;
  inventory: RepositoryInventory;
  snapshot: HomepageSnapshot;
  repositories: DashboardRepository[];
}

const candidatePattern = /\b(app|application|website|web site|dashboard|api|service|server|worker|bot|saas|platform|portal|store|shop|deploy|agent|hosted|production|monitor|ops)\b/i;
const familySuffix = /(?:[-_ ](?:hardened|fork|clone|copy|backup|new|old|final|duplicate|v\d+(?:\.\d+)*|version[-_ ]?\d+|rev[-_ ]?\d+|\d+))$/i;

export function sanitizeHomepage(value: string): string {
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

export function normalizeFamilyName(name: string): string {
  let normalized = name.toLowerCase().replace(/[._\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  let previous = "";
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(familySuffix, "").replace(/-+$/g, "");
  }
  return normalized || name.toLowerCase();
}

export function displayCheckState(check?: HomepageCheck | null): CheckState | "no-homepage" {
  return check?.status ?? "no-homepage";
}

export async function loadDashboardData(): Promise<DashboardData> {
  // Inside the Tauri shell there is no same-origin server, so the client
  // loads the envelope baked at build time (scripts/build-dashboard-data.ts
  // runs the same API handler and writes public/data/dashboard.json).
  // On the web nothing changes: the live /api/dashboard boundary answers.
  const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const response = await fetch(inTauri ? "/data/dashboard.json" : "/api/dashboard", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("Could not load the public-evidence snapshot.");
  }

  const payload = await response.json() as DashboardApiResponse;
  if (!payload.inventory || !payload.snapshot || !payload.boundary || !Array.isArray(payload.repositories)) {
    throw new Error("The server returned an invalid evidence envelope.");
  }

  const repositories = payload.repositories.map((record): DashboardRepository => {
    const safeHomepage = sanitizeHomepage(record.homepage);
    const searchableMetadata = [record.name, record.description, ...record.topics].join(" ");
    const candidateEvidence = safeHomepage
      ? "declared-homepage"
      : candidatePattern.test(searchableMetadata)
        ? "metadata-match"
        : null;

    const homepageStatus = record.homepageEvidence?.status;
    const displayState: CheckState | "no-homepage" = !safeHomepage
      ? "no-homepage"
      : homepageStatus === "reachable" || homepageStatus === "degraded" || homepageStatus === "unknown"
        ? homepageStatus
        : "unknown";

    return {
      ...record,
      homepage: safeHomepage,
      safeHomepage,
      displayState,
      operationalCandidate: candidateEvidence !== null,
      candidateEvidence,
      familyKey: normalizeFamilyName(record.name),
    };
  });

  return { ...payload, repositories };
}

export function groupRepositoryFamilies(repositories: DashboardRepository[]) {
  const groups = new Map<string, DashboardRepository[]>();
  for (const repository of repositories) {
    const group = groups.get(repository.familyKey) ?? [];
    group.push(repository);
    groups.set(repository.familyKey, group);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({ key, members }))
    .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}

export function languageCounts(repositories: DashboardRepository[]) {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const language = repository.language || "Unspecified";
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));
}

export function repositoryPriority(a: DashboardRepository, b: DashboardRepository): number {
  const rank: Record<DashboardRepository["displayState"], number> = {
    degraded: 0,
    unknown: 1,
    reachable: 2,
    "no-homepage": 3,
  };
  const stateOrder = rank[a.displayState] - rank[b.displayState];
  if (stateOrder !== 0) return stateOrder;
  return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
}
