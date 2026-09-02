import { afterEach, describe, expect, it } from "vitest";
import { MS_PER_DAY } from "../../../shared/constants.ts";
import { createVisit } from "../services/visits.ts";
import { createTestApp, headers, seedRestaurants } from "./helper.ts";

type TestContext = Awaited<ReturnType<typeof createTestApp>>;

describe("API", () => {
  let ctx: TestContext;

  afterEach(async () => {
    await ctx?.close();
  });

  it("reports health", async () => {
    ctx = await createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, db: true });
  });

  it("advertises the LAN share URL", async () => {
    ctx = await createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/api/access" });
    expect(response.statusCode).toBe(200);
    expect(response.json().shareUrl).toBe("http://10.0.0.181:3000");
  });

  it("keeps sealed submissions private until both people lock", async () => {
    ctx = await createTestApp();
    const [thai, pizza] = seedRestaurants(ctx.db, ["Thai Garden", "Pizzeria"]);

    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("a"),
      payload: { restaurantIds: [thai, pizza] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });

    const otherView = await ctx.app.inject({
      method: "GET",
      url: "/api/state",
      headers: headers("b"),
    });
    const state = otherView.json();
    expect(state.session.other.locked).toBe(true);
    expect(state.session.other.choices).toBeNull();
    expect(state.session.status).toBe("open");
  });

  it("reveals a weighted wheel after both lock and spins the same authoritative result", async () => {
    let calls = 0;
    const sequence = [0.1, 0.5];
    ctx = await createTestApp({
      random: () => sequence[Math.min(calls++, sequence.length - 1)] ?? 0.5,
    });
    const [thai, pizza, sushi] = seedRestaurants(ctx.db, ["Thai Garden", "Pizzeria", "Sushi Bar"]);

    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("a"),
      payload: { restaurantIds: [thai, pizza] },
    });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("b"),
      payload: { restaurantIds: [thai, sushi] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("b"),
    });

    const revealed = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(revealed.session.status).toBe("revealed");
    expect(revealed.session.other.choices).toEqual(expect.arrayContaining([thai, sushi]));
    const thaiSlice = revealed.session.candidates.find(
      (item: { restaurantId: string }) => item.restaurantId === thai,
    );
    expect(thaiSlice.tickets).toBe(2);
    expect(thaiSlice.probability).toBe(0.5);

    const spin = await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/spin",
      headers: headers("a"),
    });
    expect(spin.statusCode).toBe(200);

    const afterA = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    const afterB = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("b") })
    ).json();
    expect(afterA.session.result.restaurantId).toBe(afterB.session.result.restaurantId);
    expect(afterA.session.result.rotationDegrees).toBe(afterB.session.result.rotationDegrees);
  });

  it("rejects empty combined submissions", async () => {
    ctx = await createTestApp();
    seedRestaurants(ctx.db, ["Thai Garden"]);
    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });
    const second = await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("b"),
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().error.code).toBe("NO_CANDIDATES");
  });

  it("excludes the previous result from the next revealed wheel", async () => {
    ctx = await createTestApp({ random: () => 0.01 });
    const [thai, pizza] = seedRestaurants(ctx.db, ["Thai Garden", "Pizzeria"]);

    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    for (const person of ["a", "b"] as const) {
      await ctx.app.inject({
        method: "PUT",
        url: "/api/sessions/current/choices",
        headers: headers(person),
        payload: { restaurantIds: [thai] },
      });
      await ctx.app.inject({
        method: "POST",
        url: "/api/sessions/current/lock",
        headers: headers(person),
      });
    }
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/spin",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/confirm",
      headers: headers("a"),
    });

    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("b") });
    for (const person of ["a", "b"] as const) {
      await ctx.app.inject({
        method: "PUT",
        url: "/api/sessions/current/choices",
        headers: headers(person),
        payload: { restaurantIds: [thai, pizza] },
      });
      await ctx.app.inject({
        method: "POST",
        url: "/api/sessions/current/lock",
        headers: headers(person),
      });
    }

    const state = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(state.session.skippedPrevious).toBe(true);
    expect(
      state.session.candidates.map((item: { restaurantId: string }) => item.restaurantId),
    ).toEqual([pizza]);
  });

  it("creates a visit only after confirmation", async () => {
    ctx = await createTestApp({ random: () => 0.01 });
    const [thai] = seedRestaurants(ctx.db, ["Thai Garden"]);
    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("a"),
      payload: { restaurantIds: [thai] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("b"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/spin",
      headers: headers("a"),
    });

    const pending = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(pending.visits).toHaveLength(0);
    expect(pending.restaurants[0].due).toBe(true);

    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/confirm",
      headers: headers("b"),
    });
    const confirmed = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(confirmed.visits).toHaveLength(1);
    expect(confirmed.visits[0].source).toBe("confirmed_spin");
    expect(confirmed.restaurants[0].due).toBe(false);
    expect(confirmed.session).toBeNull();
  });

  it("does not record a visit when a result is skipped", async () => {
    ctx = await createTestApp({ random: () => 0.01 });
    const [thai] = seedRestaurants(ctx.db, ["Thai Garden"]);
    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("a"),
      payload: { restaurantIds: [thai] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("b"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/spin",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/reject",
      headers: headers("a"),
    });

    const state = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(state.visits).toHaveLength(0);
    expect(state.restaurants[0].due).toBe(true);
  });

  it("marks a restaurant due after the recommendation window", async () => {
    ctx = await createTestApp({ dueAfterDays: 21 });
    const [thai] = seedRestaurants(ctx.db, ["Thai Garden"]);
    createVisit(ctx.db, {
      restaurantId: thai,
      visitedAt: new Date(Date.now() - 22 * MS_PER_DAY).toISOString(),
      source: "manual",
    });

    const state = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    expect(state.restaurants[0].due).toBe(true);
    expect(state.restaurants[0].neverVisited).toBe(false);
  });

  it("round-trips export and import", async () => {
    ctx = await createTestApp();
    await ctx.app.inject({
      method: "POST",
      url: "/api/restaurants",
      headers: headers("a"),
      payload: { name: "Thai Garden", notes: "Weeknight favorite" },
    });
    const exported = (
      await ctx.app.inject({ method: "GET", url: "/api/export", headers: headers("a") })
    ).json();
    expect(exported.version).toBe(1);
    expect(exported.restaurants).toHaveLength(1);

    const other = await createTestApp();
    const imported = await other.app.inject({
      method: "POST",
      url: "/api/import",
      headers: headers("b"),
      payload: exported,
    });
    expect(imported.statusCode).toBe(200);
    const restored = (
      await other.app.inject({ method: "GET", url: "/api/state", headers: headers("b") })
    ).json();
    expect(restored.restaurants[0].name).toBe("Thai Garden");
    await other.close();
  });

  it("recovers the same pending session after a later request", async () => {
    ctx = await createTestApp({ random: () => 0.01 });
    const [thai] = seedRestaurants(ctx.db, ["Thai Garden"]);
    await ctx.app.inject({ method: "POST", url: "/api/sessions", headers: headers("a") });
    await ctx.app.inject({
      method: "PUT",
      url: "/api/sessions/current/choices",
      headers: headers("a"),
      payload: { restaurantIds: [thai] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("a"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/lock",
      headers: headers("b"),
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/sessions/current/spin",
      headers: headers("a"),
    });

    const first = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("a") })
    ).json();
    const second = (
      await ctx.app.inject({ method: "GET", url: "/api/state", headers: headers("b") })
    ).json();
    expect(first.session.status).toBe("spun");
    expect(second.session.result.restaurantId).toBe(first.session.result.restaurantId);
    expect(second.session.result.rotationDegrees).toBe(first.session.result.rotationDegrees);
  });

  it("broadcasts a live event after a mutation", async () => {
    ctx = await createTestApp();
    const reasons: string[] = [];
    const original = ctx.events.emit.bind(ctx.events);
    ctx.events.emit = (reason: string) => {
      reasons.push(reason);
      original(reason);
    };

    await ctx.app.inject({
      method: "POST",
      url: "/api/restaurants",
      headers: headers("a"),
      payload: { name: "Ramen House" },
    });
    expect(reasons).toContain("restaurant.created");
  });
});
