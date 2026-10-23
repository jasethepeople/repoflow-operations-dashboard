import { describe, expect, it } from "bun:test";
import { handleDashboardRequest } from "../server/api.ts";
import type { DashboardApiResponse } from "../src/data.ts";

describe("public evidence API boundary", () => {
  it("labels public repository data and preserves homepage outcomes", async () => {
    const response = await handleDashboardRequest(new Request("http://localhost/api/dashboard"));
    expect(response.status).toBe(200);
    const payload = await response.json() as DashboardApiResponse;

    expect(payload.repositories).toHaveLength(payload.inventory.repositoryCount);
    expect(payload.snapshot.checks).toHaveLength(payload.snapshot.checkCount);
    expect(payload.inventory.repositoryCount).toBe(305);
    expect(payload.snapshot.checkCount).toBe(175);
    const states = payload.snapshot.checks.reduce<Record<string, number>>((counts, check) => {
      counts[check.status] = (counts[check.status] ?? 0) + 1;
      return counts;
    }, {});
    expect(states).toEqual({ reachable: 59, degraded: 31, unknown: 85 });
    expect(payload.snapshot.checks.filter((check) => check.httpStatus === 429).every((check) => check.status === "unknown")).toBe(true);
    expect(payload.snapshot.checks.filter((check) => check.httpStatus === 307).every((check) => check.status === "reachable")).toBe(true);
    expect(payload.repositories.every((repository) => repository.repositoryEvidence.status === "public-evidence")).toBe(true);

    for (const check of payload.snapshot.checks) {
      const expected = check.httpStatus === null || check.httpStatus === 429
        ? "unknown"
        : check.httpStatus >= 200 && check.httpStatus < 400
          ? "reachable"
          : "degraded";
      expect(check.status).toBe(expected);
      const url = new URL(check.url);
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }

    for (const repository of payload.repositories) {
      if (!repository.homepage) {
        expect(repository.homepageEvidence).toBeNull();
        continue;
      }
      const check = payload.snapshot.checks.find((item) => item.url === repository.homepage);
      expect(repository.homepageEvidence?.status).toBe(check?.status ?? "unknown");
      expect(repository.homepageEvidence?.status).not.toBe("verified-live");
    }
  });

  it("keeps authenticated integrations unavailable until configured", async () => {
    const response = await handleDashboardRequest(new Request("http://localhost/api/dashboard"));
    const payload = await response.json() as DashboardApiResponse;

    expect(payload.boundary.apiBoundary.status).toBe("configured");
    expect(payload.boundary.repositoryInventory.status).toBe("public-evidence");
    expect(payload.boundary.privateRepositories.status).toBe("not-authorized");
    expect(payload.boundary.actionsRuns.status).toBe("not-authorized");
    expect(payload.boundary.deploymentMetadata.status).toBe("not-authorized");
    expect(payload.boundary.webhookDeliveryHistory.status).toBe("not-authorized");
    expect(payload.boundary.runtimeHealth.status).toBe("unknown");
    expect(payload.boundary.serviceVerification.status).toBe("unknown");
    expect(payload.repositories.some((repository) => repository.repositoryEvidence.status === "verified-live")).toBe(false);
  });

  it("rejects writes and unknown API routes", async () => {
    const write = await handleDashboardRequest(new Request("http://localhost/api/dashboard", { method: "POST" }));
    const missing = await handleDashboardRequest(new Request("http://localhost/api/private"));
    expect(write.status).toBe(405);
    expect(missing.status).toBe(404);
  });
});
