import { describe, expect, it } from "vitest";
import {
  buildTickets,
  excludePrevious,
  layoutSlices,
  pickWeighted,
  rotationForResult,
  totalTickets,
} from "./spin.ts";

const names = new Map([
  ["thai", "Thai Garden"],
  ["pizza", "Pizzeria"],
  ["sushi", "Sushi Bar"],
]);

describe("buildTickets", () => {
  it("gives one ticket per selected restaurant per person", () => {
    const tickets = buildTickets([
      ["thai", "pizza"],
      ["thai", "sushi"],
    ]);
    expect(Object.fromEntries(tickets)).toEqual({ thai: 2, pizza: 1, sushi: 1 });
    expect(totalTickets(tickets)).toBe(4);
  });

  it("ignores duplicate ids from the same person", () => {
    const tickets = buildTickets([["thai", "thai", "pizza"]]);
    expect(Object.fromEntries(tickets)).toEqual({ thai: 1, pizza: 1 });
  });
});

describe("excludePrevious", () => {
  it("drops the previous result when another candidate exists", () => {
    const tickets = buildTickets([["thai", "pizza"], ["thai"]]);
    const next = excludePrevious(tickets, "thai");
    expect(Object.fromEntries(next)).toEqual({ pizza: 1 });
  });

  it("keeps original relative weights of remaining candidates", () => {
    const tickets = new Map([
      ["thai", 2],
      ["pizza", 1],
      ["sushi", 1],
    ]);
    const next = excludePrevious(tickets, "thai");
    expect(next.get("pizza")).toBe(1);
    expect(next.get("sushi")).toBe(1);
    expect(totalTickets(next)).toBe(2);
  });

  it("keeps the previous result when it is the only candidate", () => {
    const tickets = new Map([["thai", 2]]);
    expect(excludePrevious(tickets, "thai").get("thai")).toBe(2);
  });
});

describe("layoutSlices", () => {
  it("assigns double the angle to a restaurant with two tickets", () => {
    const slices = layoutSlices(
      new Map([
        ["thai", 2],
        ["pizza", 1],
        ["sushi", 1],
      ]),
      names,
    );
    const thai = slices.find((slice) => slice.restaurantId === "thai")!;
    expect(thai.probability).toBe(0.5);
    expect(thai.sliceAngleDegrees).toBe(180);
    expect(slices.reduce((sum, slice) => sum + slice.probability, 0)).toBeCloseTo(1);
  });
});

describe("pickWeighted", () => {
  it("throws when there are no tickets", () => {
    expect(() => pickWeighted(new Map())).toThrow("NO_CANDIDATES");
  });

  it("picks according to ticket ranges", () => {
    const tickets = new Map([
      ["pizza", 1],
      ["sushi", 1],
      ["thai", 2],
    ]);
    expect(pickWeighted(tickets, () => 0)).toBe("pizza");
    expect(pickWeighted(tickets, () => 0.99)).toBe("thai");
  });
});

describe("rotationForResult", () => {
  it("lands inside the winning slice after extra spins", () => {
    const slices = layoutSlices(
      new Map([
        ["pizza", 1],
        ["thai", 1],
      ]),
      names,
    );
    const rotation = rotationForResult(slices, "thai", () => 0.5, 6);
    const landing = (360 - (rotation % 360) + 360) % 360;
    const thai = slices.find((slice) => slice.restaurantId === "thai")!;
    expect(landing).toBeGreaterThanOrEqual(thai.sliceStartDegrees);
    expect(landing).toBeLessThanOrEqual(thai.sliceStartDegrees + thai.sliceAngleDegrees);
  });
});
