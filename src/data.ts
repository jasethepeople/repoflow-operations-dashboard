export type CheckState = "reachable" | "degraded" | "unknown";
export type DisplayState = CheckState | "unknown" | "not-authorized" | "verified-live";

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

export interface DashboardRepository extends RepositoryRecord {
  safeHomepage: string;
  homepageCheck?: HomepageCheck;
  displayState: DisplayState | "no-homepage";
  operationalCandidate: boolean;
  candidateEvidence: "declared-homepage" | "metadata-match" | null;
  familyKey: string;
}

export interface DashboardData {
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

export function displayCheckState(check?: HomepageCheck): DisplayState | "no-homepage" {
  if (!check) return "no-homepage";
  if (check.httpStatus === 429) return "unknown";
  if (check.httpStatus !== null && check.httpStatus >= 300 && check.httpStatus < 400) return "reachable";
  return check.status;
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [inventoryResponse, snapshotResponse] = await Promise.all([
    fetch("/data/inventory.json"),
    fetch("/data/homepage-checks.json"),
  ]);
  if (!inventoryResponse.ok || !snapshotResponse.ok) {
    throw new Error("Could not load the bundled public-evidence snapshot.");
  }

  const [inventory, snapshot] = await Promise.all([
    inventoryResponse.json() as Promise<RepositoryInventory>,
    snapshotResponse.json() as Promise<HomepageSnapshot>,
  ]);
  const checks = new Map(snapshot.checks.map((check) => [sanitizeHomepage(check.url), check]));
  const repositories = inventory.repositories.map((repository): DashboardRepository => {
    const safeHomepage = sanitizeHomepage(repository.homepage);
    const homepageCheck = safeHomepage ? checks.get(safeHomepage) : undefined;
    const searchableMetadata = [repository.name, repository.description, ...repository.topics].join(" ");
    const candidateEvidence = safeHomepage
      ? "declared-homepage"
      : candidatePattern.test(searchableMetadata)
        ? "metadata-match"
        : null;

    return {
      ...repository,
      homepage: safeHomepage,
      safeHomepage,
      homepageCheck,
      displayState: displayCheckState(homepageCheck),
      operationalCandidate: candidateEvidence !== null,
      candidateEvidence,
      familyKey: normalizeFamilyName(repository.name),
    };
  });

  return { inventory, snapshot, repositories };
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
    "not-authorized": 4,
    "verified-live": 5,
  };
  const stateOrder = rank[a.displayState] - rank[b.displayState];
  if (stateOrder !== 0) return stateOrder;
  return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
}
