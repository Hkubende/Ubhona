import { describe, expect, it, vi } from "vitest";
import { checkDbReachable, classifyDbError, getBackendBuildIdentity, summarizeDbConfig } from "../runtime/health.js";

describe("runtime health helpers", () => {
  it("exposes safe backend build identity fields from runtime env", () => {
    const identity = getBackendBuildIdentity({
      env: {
        RENDER_GIT_COMMIT: "abc123def456",
        RENDER_GIT_BRANCH: "main",
        RENDER_SERVICE_NAME: "ubhona-api",
        RENDER_SERVICE_ID: "srv_123",
        RENDER_EXTERNAL_URL: "https://ubhona-api.onrender.com",
        RENDER_EXTERNAL_HOSTNAME: "ubhona-api.onrender.com",
      },
      startedAt: "2026-04-29T00:00:00.000Z",
    });

    expect(identity.commitSha).toBe("abc123def456");
    expect(identity.branch).toBe("main");
    expect(identity.deployServiceName).toBe("ubhona-api");
    expect(identity.deployServiceId).toBe("srv_123");
    expect(identity.externalUrl).toBe("https://ubhona-api.onrender.com");
    expect(identity.externalHostname).toBe("ubhona-api.onrender.com");
    expect(identity.startedAt).toBe("2026-04-29T00:00:00.000Z");
    expect(identity.healthShapeVersion).toBe(2);
    expect(identity.packageName.length).toBeGreaterThan(0);
    expect(identity.packageVersion.length).toBeGreaterThan(0);
  });

  it("summarizes a session pooler database url safely", () => {
    const summary = summarizeDbConfig({
      DATABASE_URL:
        "postgresql://postgres.project-ref:super-secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    });

    expect(summary.host).toBe("aws-1-eu-central-1.pooler.supabase.com");
    expect(summary.port).toBe(5432);
    expect(summary.mode).toBe("session_pooler");
    expect(summary.pooler).toBe(true);
    expect(summary.hasProjectRefInUsername).toBe(true);
    expect(summary.username).toBe("p***");
  });

  it("returns a structured db health failure instead of throwing when the probe fails", async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const result = await checkDbReachable({
      env: {
        DATABASE_URL:
          "postgresql://postgres.project-ref:super-secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
      },
      clientFactory: () => ({
        connect: vi.fn().mockRejectedValue(Object.assign(new Error("password authentication failed"), { code: "28P01" })),
        query: vi.fn(),
        end,
      }),
    });

    expect(result.reachable).toBe(false);
    expect(result.reason).toBe("auth");
    expect(result.message).toContain("password authentication failed");
    expect(result.hint).toContain("session pooler");
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("classifies malformed connection failures", () => {
    expect(classifyDbError(new Error("invalid connection string"))).toBe("malformed");
  });
});
