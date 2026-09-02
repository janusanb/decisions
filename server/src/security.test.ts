import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, isLocalDevOrigin } from "./security.ts";
import { createTestApp } from "./test/helper.ts";

describe("isLocalDevOrigin", () => {
  it("allows the Vite dev server", () => {
    expect(isLocalDevOrigin("http://localhost:5173")).toBe(true);
    expect(isLocalDevOrigin("http://127.0.0.1:5173")).toBe(true);
  });

  it("rejects other sites", () => {
    expect(isLocalDevOrigin("https://evil.example")).toBe(false);
    expect(isLocalDevOrigin("http://10.0.0.181:3000")).toBe(false);
  });
});

describe("security headers", () => {
  it("keeps API responses off shared caches and out of third-party frames", async () => {
    const ctx = await createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-security-policy"]).toBe(CONTENT_SECURITY_POLICY);
    expect(String(response.headers["content-security-policy"])).toContain("connect-src 'self'");
    await ctx.close();
  });

  it("does not grant CORS to a third-party origin", async () => {
    const ctx = await createTestApp();
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/export",
      headers: {
        origin: "https://evil.example",
        "x-participant-id": "a",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await ctx.close();
  });
});
