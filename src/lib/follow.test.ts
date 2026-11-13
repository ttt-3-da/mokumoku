import { describe, expect, it } from "vitest";
import { barPercent } from "./follow";

describe("barPercent", () => {
  it("いちばん多い人を100%にする", () => {
    expect(barPercent(120, 120)).toBe(100);
    expect(barPercent(60, 120)).toBe(50);
  });
  it("0分でも少しだけ見える。全員0分でも割り算しない", () => {
    expect(barPercent(0, 120)).toBe(2);
    expect(barPercent(0, 0)).toBe(2);
  });
});
