import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  GitBranch,
  Layers3,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  groupRepositoryFamilies,
  languageCounts,
  loadDashboardData,
  displayCheckState,
  repositoryPriority,
  type DashboardData,
  type DashboardRepository,
  type DisplayState,
} from "./data";

type View = "overview" | "repositories" | "reachability" | "relationships";
type AccountFilter = "all" | "jasethepeople" | "jasonclarkagain";
type ScopeFilter = "all" | "homepage" | "candidates" | "forks" | "archived";
type HealthFilter = "all" | "reachable" | "degraded" | "unknown" | "no-homepage";

const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Signal room", icon: LayoutDashboard },
  { id: "repositories", label: "Repositories", icon: GitBranch },
  { id: "reachability", label: "Homepage evidence", icon: Activity },
  { id: "relationships", label: "Families & stack", icon: Layers3 },
];

const titleByView: Record<View, { title: string; eyebrow: string; description: string }> = {
  overview: {
    title: "Portfolio signal room",
    eyebrow: "OPERATIONS / OVERVIEW",
    description: "See the shape of both public portfolios, with evidence and uncertainty kept in view.",
  },
  repositories: {
    title: "Repository inventory",
    eyebrow: "PUBLIC INVENTORY / SNAPSHOT",
    description: "Search, scope, and inspect the public repository set without flattening it into a card wall.",
  },
  reachability: {
    title: "Declared homepage checks",
    eyebrow: "HTTP SNAPSHOT / PUBLIC URLS",
    description: "A point-in-time GET result—not an application health check, uptime monitor, or live-service claim.",
  },
  relationships: {
    title: "Stack & name families",
    eyebrow: "DERIVED SIGNALS / CLIENT-SIDE",
    description: "Language counts and repository-name similarities are navigation hints, not proof of shared code or ownership.",
  },
};

function shortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" }).format(parsed);
}

function snapshotTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "snapshot time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  }).format(parsed);
}

function prettyNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusCopy(status: DisplayState | "no-homepage") {
  if (status === "reachable") return "Reachable at snapshot";
  if (status === "degraded") return "Degraded · HTTP response";
  if (status === "unknown") return "Unknown · rate limited";
  if (status === "not-authorized") return "Not authorized";
  if (status === "verified-live") return "Verified live";
  return "No homepage declared";
}

function StatusTag({ status, compact = false }: { status: DisplayState | "no-homepage"; compact?: boolean }) {
  const icon = status === "reachable" ? <span className="status-dot" /> : status === "degraded" ? <ArrowDownRight size={12} /> : status === "unknown" ? <CircleHelp size={12} /> : status === "verified-live" ? <ShieldCheck size={12} /> : status === "not-authorized" ? <LockKeyhole size={12} /> : <span className="status-dash">—</span>;
  const label = status === "reachable" && compact ? "Reachable" : statusCopy(status);
  return <span className={`status-tag status-${status}`}>{icon}<span>{label}</span></span>;
}

function SignalMark() {
  return <span className="signal-mark" aria-hidden="true"><i /><b /><i /></span>;
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <span className="mini-label">{children}</span>;
}

function RepositoryTable({
  repositories,
  onOpen,
  compact = false,
}: {
  repositories: DashboardRepository[];
  onOpen: (repository: DashboardRepository) => void;
  compact?: boolean;
}) {
  return (
    <div className={`table-wrap ${compact ? "table-compact" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Account</th>
            <th>Language</th>
            <th>Evidence</th>
            <th>Last push</th>
            <th aria-label="Open detail" />
          </tr>
        </thead>
        <tbody>
          {repositories.map((repository) => (
            <tr key={repository.id} onClick={() => onOpen(repository)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(repository)}>
              <td className="repo-cell">
                <div className="repo-name"><span>{repository.name}</span>{repository.archived && <span className="archived-tag">ARCHIVED</span>}</div>
                <div className="repo-description">{repository.description || "No description provided"}</div>
              </td>
              <td><span className="account-label">{repository.owner}</span></td>
              <td><span className="language-cell"><span className="language-dot" />{repository.language || "Unspecified"}</span></td>
              <td><StatusTag status={repository.displayState} compact /></td>
              <td className="mono muted-cell">{shortDate(repository.pushedAt)}</td>
              <td><button className="icon-button row-open" aria-label={`Open ${repository.fullName}`} onClick={(event) => { event.stopPropagation(); onOpen(repository); }}><ExternalLink size={14} /></button></td>
            </tr>
          ))}
          {repositories.length === 0 && <tr><td colSpan={6} className="empty-cell">No repositories match this instrument setting.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<AccountFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [selectedRepository, setSelectedRepository] = useState<DashboardRepository | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    loadDashboardData().then(setData).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : "Snapshot could not be loaded.");
    });
  }, []);


  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("repositories");
        window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-label="Search repositories"]')?.focus());
      }
      if (event.key === "Escape") setSelectedRepository(null);
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const repositories = data?.repositories ?? [];
  const checks = data?.snapshot.checks ?? [];
  const families = useMemo(() => groupRepositoryFamilies(repositories), [repositories]);
  const languageData = useMemo(() => languageCounts(repositories), [repositories]);
  const counts = useMemo(() => ({
    total: repositories.length,
    homepages: repositories.filter((repository) => repository.safeHomepage).length,
    candidates: repositories.filter((repository) => repository.operationalCandidate).length,
    reachable: repositories.filter((repository) => repository.displayState === "reachable").length,
    degraded: repositories.filter((repository) => repository.displayState === "degraded").length,
    unknown: repositories.filter((repository) => repository.displayState === "unknown").length,
    withoutHomepage: repositories.filter((repository) => repository.displayState === "no-homepage").length,
  }), [repositories]);

  const filteredRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return repositories.filter((repository) => {
      const queryMatch = !normalizedQuery || [repository.fullName, repository.description, repository.language ?? "", ...repository.topics].join(" ").toLowerCase().includes(normalizedQuery);
      const accountMatch = account === "all" || repository.owner === account;
      const scopeMatch = scope === "all"
        || (scope === "homepage" && Boolean(repository.safeHomepage))
        || (scope === "candidates" && repository.operationalCandidate)
        || (scope === "forks" && repository.isFork)
        || (scope === "archived" && repository.archived);
      const healthMatch = health === "all" || repository.displayState === health;
      return queryMatch && accountMatch && scopeMatch && healthMatch;
    }).sort(repositoryPriority);
  }, [repositories, query, account, scope, health]);

  const selectedView = titleByView[view];
  const checkCounts = useMemo(() => ({
    reachable: checks.filter((check) => displayCheckState(check) === "reachable").length,
    rateLimited: checks.filter((check) => displayCheckState(check) === "unknown").length,
    degraded: checks.filter((check) => displayCheckState(check) === "degraded").length,
  }), [checks]);

  function openRepository(repository: DashboardRepository) {
    setSelectedRepository(repository);
  }

  if (!data && !loadError) {
    return <div className="loading-screen"><SignalMark /><span>ASSEMBLING PUBLIC EVIDENCE</span><div className="loading-line"><i /></div></div>;
  }

  if (loadError || !data) {
    return <div className="error-screen"><SignalMark /><p>Snapshot unavailable</p><span>{loadError}</span><button className="button button-quiet" onClick={() => window.location.reload()}>Reload dashboard</button></div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><SignalMark /><div><strong>RepoFlow</strong><span>OPERATIONS DESK</span></div></div>
        <div className="rail-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard views">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${view === id ? "nav-active" : ""}`} key={id} onClick={() => setView(id)}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>{id === "repositories" && <span className="nav-count">{prettyNumber(counts.total)}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-caption rail-caption-spaced">ACCOUNTS IN SCOPE</div>
        <button className={`account-switch ${account === "jasethepeople" ? "account-selected" : ""}`} onClick={() => setAccount(account === "jasethepeople" ? "all" : "jasethepeople")}>
          <span className="avatar avatar-amber">J</span><span>jasethepeople</span><span className="account-repo-count">{prettyNumber(repositories.filter((repository) => repository.owner === "jasethepeople").length)}</span>
        </button>
        <button className={`account-switch ${account === "jasonclarkagain" ? "account-selected" : ""}`} onClick={() => setAccount(account === "jasonclarkagain" ? "all" : "jasonclarkagain")}>
          <span className="avatar avatar-slate">J</span><span>jasonclarkagain</span><span className="account-repo-count">{prettyNumber(repositories.filter((repository) => repository.owner === "jasonclarkagain").length)}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="access-card">
            <div className="access-card-head"><LockKeyhole size={14} /><span>PUBLIC SCOPE</span></div>
            <p>Private repositories and runtime integrations are not connected.</p>
            <span className="access-state"><i /> NOT AUTHORIZED</span>
          </div>
          <div className="sidebar-footer"><span>REPOFLOW <span className="footer-version">0.1</span></span></div>
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{selectedView.title}</strong></div>
          <div className="topbar-actions"><span className="snapshot-indicator"><i /> STATIC SNAPSHOT</span><span className="avatar avatar-profile">JC</span></div>
        </header>

        <nav className="mobile-nav" aria-label="Dashboard views">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "mobile-nav-active" : ""} onClick={() => setView(id)}><Icon size={15} strokeWidth={1.8} /><span>{label}</span></button>)}
        </nav>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />{selectedView.eyebrow}</div>
              <h1>{selectedView.title}</h1>
              <p>{selectedView.description}</p>
            </div>
            <div className="heading-right"><span className="snapshot-stamp">SNAPSHOT · {snapshotTime(data.inventory.generatedAt)}</span><button className="button button-quiet" onClick={() => { setQuery(""); setAccount("all"); setScope("all"); setHealth("all"); }}><Settings2 size={14} />Reset instruments</button></div>
          </div>

          {view === "overview" && <Overview
            data={data}
            counts={counts}
            checkCounts={checkCounts}
            languageData={languageData}
            families={families}
            repositories={repositories}
            setView={setView}
            onOpen={openRepository}
          />}

          {view === "repositories" && <RepositoriesView
            repositories={filteredRepositories}
            total={repositories.length}
            query={query}
            setQuery={setQuery}
            account={account}
            setAccount={setAccount}
            scope={scope}
            setScope={setScope}
            health={health}
            setHealth={setHealth}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            onOpen={openRepository}
          />}

          {view === "reachability" && <ReachabilityView data={data} checkCounts={checkCounts} onOpen={openRepository} />}

          {view === "relationships" && <RelationshipsView repositories={repositories} languageData={languageData} families={families} onOpen={openRepository} />}

          <footer className="page-footer"><span>PUBLIC EVIDENCE, CLEARLY BOUNDED.</span><span>Inventory: {data.inventory.source} · Homepage probes: {data.snapshot.source}</span></footer>
        </div>
      </main>

      {selectedRepository && <RepositoryDrawer repository={selectedRepository} onClose={() => setSelectedRepository(null)} />}
    </div>
  );
}

function Overview({
  data,
  counts,
  checkCounts,
  languageData,
  families,
  repositories,
  setView,
  onOpen,
}: {
  data: DashboardData;
  counts: { total: number; homepages: number; candidates: number; reachable: number; degraded: number; unknown: number; withoutHomepage: number };
  checkCounts: { reachable: number; rateLimited: number; degraded: number };
  languageData: { language: string; count: number }[];
  families: { key: string; members: DashboardRepository[] }[];
  repositories: DashboardRepository[];
  setView: (view: View) => void;
  onOpen: (repository: DashboardRepository) => void;
}) {
  const evidenceQueue = [...new Map([...repositories].filter((repository) => repository.homepageCheck).sort(repositoryPriority).map((repository) => [repository.safeHomepage, repository])).values()].slice(0, 7);
  const maxLanguageCount = languageData[0]?.count ?? 1;
  const topLanguages = languageData.slice(0, 6);

  return <>
    <section className="metrics-grid" aria-label="Portfolio metrics">
      <Metric label="PUBLIC REPOSITORIES" value={prettyNumber(counts.total)} detail="Across 2 GitHub accounts" icon={GitBranch} tone="neutral" />
      <Metric label="DECLARED HOMEPAGES" value={prettyNumber(counts.homepages)} detail="Repository metadata only" icon={ExternalLink} tone="amber" />
      <Metric label="REACHABLE AT SNAPSHOT" value={prettyNumber(checkCounts.reachable)} detail={`of ${prettyNumber(data.snapshot.checkCount)} HTTP checks`} icon={Activity} tone="teal" />
      <Metric label="VERIFIED LIVE" value="0" detail="No runtime health integration" icon={ShieldCheck} tone="quiet" />
    </section>

    <section className="overview-grid">
      <div className="panel evidence-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />EVIDENCE STREAM</div><h2>Homepage probe queue</h2><p>Declared URLs ordered by follow-up priority.</p></div><button className="text-button" onClick={() => setView("reachability")}>All checks <ArrowUpRight size={14} /></button></div>
        <div className="queue-list">
          {evidenceQueue.map((repository, index) => (
            <button className="queue-row" key={`${repository.id}-${index}`} onClick={() => onOpen(repository)}>
              <span className={`queue-index ${repository.displayState === "degraded" ? "queue-index-alert" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="queue-main"><strong>{repository.name}</strong><small>{repository.owner} <span>·</span> {repository.homepageCheck?.finalHost || "declared URL"}</small></span>
              <span className="queue-evidence"><StatusTag status={repository.displayState} compact /><small className="mono">HTTP {repository.homepageCheck?.httpStatus ?? "—"}</small></span>
            </button>
          ))}
        </div>
        <div className="panel-footnote"><CircleHelp size={13} /> A response can establish reachability only at check time; it does not verify application behavior.</div>
      </div>

      <aside className="health-rail">
        <div className="panel status-panel">
          <div className="panel-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" />CHECK OUTCOME</div><h2>{prettyNumber(data.snapshot.checkCount)} homepage probes</h2></div><span className="small-live-tag">ONE-TIME</span></div>
          <div className="status-breakdown">
            <div><span className="break-label"><i className="break-dot dot-teal" />Reachable</span><strong>{prettyNumber(checkCounts.reachable)}</strong></div>
            <div><span className="break-label"><i className="break-dot dot-amber" />HTTP issue</span><strong>{prettyNumber(checkCounts.degraded)}</strong></div>
            <div><span className="break-label"><i className="break-dot dot-muted" />Rate-limited / unknown</span><strong>{prettyNumber(checkCounts.rateLimited)}</strong></div>
          </div>
          <div className="stacked-bar"><i className="bar-teal" style={{ width: `${(checkCounts.reachable / data.snapshot.checkCount) * 100}%` }} /><i className="bar-amber" style={{ width: `${(checkCounts.degraded / data.snapshot.checkCount) * 100}%` }} /><i className="bar-muted" style={{ width: `${(checkCounts.rateLimited / data.snapshot.checkCount) * 100}%` }} /></div>
          <div className="snapshot-note">Captured {snapshotTime(data.snapshot.generatedAt)} · no retries</div>
        </div>

        <div className="panel access-panel">
          <div className="panel-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" />INTEGRATION BOUNDARY</div><h2>Authorization gaps</h2></div><LockKeyhole size={15} className="muted-icon" /></div>
          <div className="gap-row"><span>Private repositories</span><StatusTag status="not-authorized" compact /></div>
          <div className="gap-row"><span>Actions & deployment</span><StatusTag status="not-authorized" compact /></div>
          <div className="gap-row"><span>Webhook & live health</span><StatusTag status="not-authorized" compact /></div>
          <button className="text-button gap-action" onClick={() => setView("repositories")}>Inspect public inventory <ArrowUpRight size={14} /></button>
        </div>
      </aside>
    </section>

    <section className="lower-grid">
      <div className="panel stack-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />LANGUAGE METADATA</div><h2>Stack distribution</h2><p>Primary language field from GitHub repository metadata.</p></div><button className="icon-button" onClick={() => setView("relationships")} title="View stack and name families"><ArrowUpRight size={15} /></button></div>
        <div className="language-list">
          {topLanguages.map(({ language, count }, index) => <div className="language-row" key={language}><span className="language-rank">{String(index + 1).padStart(2, "0")}</span><span className="language-name">{language}</span><span className="language-track"><i style={{ width: `${Math.max(3, (count / maxLanguageCount) * 100)}%` }} /></span><strong>{count}</strong></div>)}
        </div>
        <div className="panel-footnote"><BookOpen size={13} /> {prettyNumber(languageData.find((item) => item.language === "Unspecified")?.count ?? 0)} repositories have no primary language value.</div>
      </div>

      <div className="panel family-panel">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />NAME SIMILARITY</div><h2>Repository families</h2><p>Suffix-normalized name matches; inspect before acting.</p></div><span className="family-count">{families.length}</span></div>
        <div className="family-preview-list">
          {families.slice(0, 4).map((family) => <button className="family-preview" key={family.key} onClick={() => setView("relationships")}><span className="family-symbol"><Layers3 size={14} /></span><span className="family-preview-main"><strong>{family.key}</strong><small>{family.members.map((member) => member.name).join(" · ")}</small></span><span className="family-member-count">{family.members.length}</span></button>)}
          {families.length === 0 && <div className="empty-inline">No name-family matches in the current snapshot.</div>}
        </div>
        <button className="text-button family-more" onClick={() => setView("relationships")}>Open relationship view <ArrowUpRight size={14} /></button>
      </div>
    </section>
  </>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone: "neutral" | "amber" | "teal" | "quiet" }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><Icon size={16} strokeWidth={1.8} /></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div><span className="metric-corner" /></div>;
}

function RepositoriesView({
  repositories,
  total,
  query,
  setQuery,
  account,
  setAccount,
  scope,
  setScope,
  health,
  setHealth,
  filterOpen,
  setFilterOpen,
  onOpen,
}: {
  repositories: DashboardRepository[];
  total: number;
  query: string;
  setQuery: (query: string) => void;
  account: AccountFilter;
  setAccount: (account: AccountFilter) => void;
  scope: ScopeFilter;
  setScope: (scope: ScopeFilter) => void;
  health: HealthFilter;
  setHealth: (health: HealthFilter) => void;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  onOpen: (repository: DashboardRepository) => void;
}) {
  return <section className="panel repository-panel">
    <div className="repository-toolbar">
      <div className="search-wrap"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, description, stack, topic…" aria-label="Search repositories" />{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}<kbd>⌘ K</kbd></div>
      <button className={`button ${filterOpen ? "button-filter-active" : "button-quiet"}`} onClick={() => setFilterOpen(!filterOpen)}><ListFilter size={14} />Filters<span className="filter-chevron"><ChevronDown size={13} /></span></button>
      <span className="result-count"><strong>{prettyNumber(repositories.length)}</strong> / {prettyNumber(total)} shown</span>
    </div>
    {filterOpen && <div className="filter-bar">
      <label>ACCOUNT<select value={account} onChange={(event) => setAccount(event.target.value as AccountFilter)}><option value="all">Both accounts</option><option value="jasethepeople">jasethepeople</option><option value="jasonclarkagain">jasonclarkagain</option></select></label>
      <label>REPOSITORY TYPE<select value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}><option value="all">All repositories</option><option value="homepage">Homepage declared</option><option value="candidates">Operational metadata match</option><option value="forks">Forks</option><option value="archived">Archived</option></select></label>
      <label>HTTP EVIDENCE<select value={health} onChange={(event) => setHealth(event.target.value as HealthFilter)}><option value="all">Any evidence state</option><option value="reachable">Reachable at snapshot</option><option value="degraded">Degraded · HTTP response</option><option value="unknown">Unknown · rate limited</option><option value="no-homepage">No homepage declared</option></select></label>
      <button className="clear-filters" onClick={() => { setAccount("all"); setScope("all"); setHealth("all"); }}>Clear filters</button>
    </div>}
    <div className="inventory-subhead"><span>PUBLIC REPOSITORY RECORDS</span><span>Sorted by evidence state, then recent push</span></div>
    <RepositoryTable repositories={repositories} onOpen={onOpen} />
    <div className="table-bottom-note"><CircleHelp size={13} /> Search and filters operate on the bundled snapshot. Select a row for repository and homepage evidence.</div>
  </section>;
}

function ReachabilityView({ data, checkCounts, onOpen }: { data: DashboardData; checkCounts: { reachable: number; rateLimited: number; degraded: number }; onOpen: (repository: DashboardRepository) => void }) {
  const checkedRepositories = [...data.repositories].filter((repository) => repository.homepageCheck).sort(repositoryPriority);
  const [query, setQuery] = useState("");
  const filtered = checkedRepositories.filter((repository) => `${repository.fullName} ${repository.homepageCheck?.url ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="callout callout-amber"><CircleHelp size={16} /><div><strong>Reachability is not health.</strong><span>These are unauthenticated HTTP GET responses captured once at {snapshotTime(data.snapshot.generatedAt)}. A 429 is classified as unknown because the destination limited the probe; neither a successful response nor an error establishes application behavior.</span></div></div>
    <div className="reach-summary">
      <Metric label="CHECKED URLS" value={prettyNumber(data.snapshot.checkCount)} detail="Unique declared homepage URLs" icon={Activity} tone="neutral" />
      <Metric label="REACHABLE AT SNAPSHOT" value={prettyNumber(checkCounts.reachable)} detail="HTTP response received" icon={ArrowUpRight} tone="teal" />
      <Metric label="HTTP RESPONSE ISSUE" value={prettyNumber(checkCounts.degraded)} detail="Non-429 non-success result" icon={ArrowDownRight} tone="amber" />
      <Metric label="UNKNOWN · RATE LIMITED" value={prettyNumber(checkCounts.rateLimited)} detail="No health conclusion" icon={CircleHelp} tone="quiet" />
    </div>
    <section className="panel reach-table-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />DECLARED HOMEPAGE URLS</div><h2>Probe evidence</h2><p>URL-level checks joined to repository declarations where available.</p></div><div className="search-wrap search-small"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter checked URLs…" aria-label="Filter checked URLs" /></div></div>
      <div className="table-wrap"><table><thead><tr><th>Repository</th><th>Declared host</th><th>HTTP result</th><th>Response</th><th>Checked</th><th /></tr></thead><tbody>
        {filtered.map((repository) => <tr key={repository.id} onClick={() => onOpen(repository)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(repository)}>
          <td className="repo-cell"><div className="repo-name"><span>{repository.fullName}</span></div><div className="repo-description">{repository.description || "No description provided"}</div></td>
          <td className="mono host-cell">{repository.homepageCheck?.finalHost ?? "—"}</td>
          <td><StatusTag status={repository.displayState} compact /></td>
          <td className="mono">{repository.homepageCheck?.httpStatus ?? "—"}</td>
          <td className="mono muted-cell">{repository.homepageCheck ? snapshotTime(repository.homepageCheck.checkedAt) : "—"}</td>
          <td><button className="icon-button row-open" aria-label={`Open ${repository.fullName}`} onClick={(event) => { event.stopPropagation(); onOpen(repository); }}><ExternalLink size={14} /></button></td>
        </tr>)}
        {filtered.length === 0 && <tr><td colSpan={6} className="empty-cell">No checked URLs match that filter.</td></tr>}
      </tbody></table></div>
      <div className="table-bottom-note"><span>Source: {data.snapshot.source}</span><span>{prettyNumber(checkedRepositories.length)} repository declarations map to {prettyNumber(data.snapshot.checkCount)} unique URLs.</span></div>
    </section>
  </>;
}

function RelationshipsView({ repositories, languageData, families, onOpen }: { repositories: DashboardRepository[]; languageData: { language: string; count: number }[]; families: { key: string; members: DashboardRepository[] }[]; onOpen: (repository: DashboardRepository) => void }) {
  const max = languageData[0]?.count ?? 1;
  return <div className="relationship-grid">
    <section className="panel relationships-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />POSSIBLE RELATED PROJECTS</div><h2>{prettyNumber(families.length)} name-family signals</h2><p>Heuristic suffix normalization groups similar names. Shared naming does not prove a fork, duplicate, or common implementation.</p></div><span className="family-count family-count-large"><Layers3 size={16} /></span></div>
      <div className="family-table">
        {families.map(({ key, members }) => <div className="family-group" key={key}><div className="family-group-head"><span className="family-symbol"><Layers3 size={14} /></span><strong>{key}</strong><span className="family-member-count">{members.length} records</span></div><div className="family-members">{members.map((repository) => <button className="family-member" key={repository.id} onClick={() => onOpen(repository)}><span className="member-name">{repository.fullName}</span><span className="member-meta">{repository.language || "Unspecified"}<span>·</span>{repository.isFork ? "fork" : "repository"}</span><StatusTag status={repository.displayState} compact /></button>)}</div></div>)}
        {families.length === 0 && <div className="empty-inline">No repeated name families detected in the bundled inventory.</div>}
      </div>
    </section>
    <aside className="panel stack-detail-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-line" />PRIMARY LANGUAGE</div><h2>Stack composition</h2><p>{prettyNumber(repositories.length)} public repositories</p></div></div>
      <div className="stack-detail-list">{languageData.map(({ language, count }) => <div className="stack-detail-row" key={language}><div className="stack-detail-title"><span>{language}</span><strong>{count}</strong></div><div className="stack-detail-track"><i style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div><small>{((count / repositories.length) * 100).toFixed(1)}% of inventory</small></div>)}</div>
      <div className="stack-caveat"><CircleHelp size={13} />GitHub's primary language field can omit mixed-language detail.</div>
    </aside>
  </div>;
}

function RepositoryDrawer({ repository, onClose }: { repository: DashboardRepository; onClose: () => void }) {
  const check = repository.homepageCheck;
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top"><MiniLabel>REPOSITORY DETAIL / PUBLIC EVIDENCE</MiniLabel><button className="icon-button" onClick={onClose} aria-label="Close detail"><X size={17} /></button></div>
      <div className="drawer-owner"><GitBranch size={15} />{repository.owner}</div>
      <h2 id="drawer-title">{repository.name}</h2>
      <p className="drawer-description">{repository.description || "No public description provided."}</p>
      <StatusTag status={repository.displayState} />
      <a className="drawer-primary-link" href={repository.url} target="_blank" rel="noreferrer">Open public repository <ExternalLink size={14} /></a>
      <div className="drawer-section"><div className="eyebrow"><span className="eyebrow-line" />REPOSITORY METADATA</div>
        <div className="detail-grid"><DetailItem label="PRIMARY LANGUAGE" value={repository.language || "Unspecified"} /><DetailItem label="BRANCH" value={repository.defaultBranch || "—"} /><DetailItem label="STARS" value={prettyNumber(repository.stars)} /><DetailItem label="FORKS" value={prettyNumber(repository.forks)} /><DetailItem label="CREATED" value={shortDate(repository.createdAt)} /><DetailItem label="LAST PUSH" value={shortDate(repository.pushedAt)} /></div>
        <div className="detail-row"><span>Repository type</span><span>{repository.isFork ? "Fork" : "Public repository"}{repository.archived ? " · archived" : ""}</span></div>
      </div>
      <div className="drawer-section"><div className="eyebrow"><span className="eyebrow-line" />HOMEPAGE EVIDENCE</div>
        {repository.safeHomepage ? <><a className="homepage-link" href={repository.safeHomepage} target="_blank" rel="noreferrer">{repository.homepageCheck?.finalHost ?? new URL(repository.safeHomepage).host}<ExternalLink size={13} /></a>{check ? <div className="probe-detail"><div><span>HTTP STATUS</span><strong>{check.httpStatus ?? "—"}</strong></div><div><span>RESPONSE TIME</span><strong>{check.responseMs === null ? "—" : `${check.responseMs} ms`}</strong></div><div><span>CHECKED</span><strong>{snapshotTime(check.checkedAt)}</strong></div></div> : <p className="muted-copy">A homepage is declared, but no matching URL check appears in this snapshot.</p>}<p className="drawer-caveat">{check?.httpStatus === 429 ? "This destination rate-limited the public probe. Current reachability is unknown." : "Point-in-time public GET evidence only. This does not verify application behavior or service health."}</p></> : <p className="muted-copy">No homepage URL is declared in the public repository metadata.</p>}
      </div>
      <div className="drawer-section"><div className="eyebrow"><span className="eyebrow-line" />INTEGRATION STATUS</div><div className="drawer-integration"><LockKeyhole size={14} /><span>Private repository, Actions, deployment, webhook, and runtime data are not authorized in this public-only slice.</span></div></div>
      {repository.topics.length > 0 && <div className="drawer-section"><div className="eyebrow"><span className="eyebrow-line" />TOPICS</div><div className="topic-list">{repository.topics.map((topic) => <span className="topic-tag" key={topic}>{topic}</span>)}</div></div>}
    </aside>
  </div>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

export default App;
