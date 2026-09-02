import { describe, expect, it } from "vitest";
import { daysSince, isDue } from "./due.ts";

const now = new Date("2026-09-02T12:00:00.000Z");

describe("isDue", () => {
  it("treats never-visited restaurants as due", () => {
    expect(isDue(null, now, 21)).toBe(true);
  });

  it("is not due when visited fewer than 21 days ago", () => {
    expect(isDue("2026-08-13T12:00:00.000Z", now, 21)).toBe(false);
  });

  it("is due on the 21st day", () => {
    expect(isDue("2026-08-12T12:00:00.000Z", now, 21)).toBe(true);
  });

  it("is due when the last visit is older than the window", () => {
    expect(isDue("2026-08-01T12:00:00.000Z", now, 21)).toBe(true);
  });
});

describe("daysSince", () => {
  it("returns whole days between two timestamps", () => {
    expect(daysSince("2026-08-26T12:00:00.000Z", now)).toBe(7);
  });

  it("returns null without a date", () => {
    expect(daysSince(null, now)).toBeNull();
  });
});
