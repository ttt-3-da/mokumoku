import { describe, expect, it } from "vitest";
import { parsePlacedItems, stepBounce } from "./mochi-room";

describe("stepBounce", () => {
  it("壁にぶつかると跳ね返り、床ではやがて止まる", () => {
    let b = { x: 10, y: 10, vx: -900, vy: -300 };
    const r = stepBounce(b, 0.016, 400, 300, 80);
    expect(r.x).toBe(0);
    expect(r.vx).toBeGreaterThan(0);
    expect(r.hit).toBe(true);
    for (let i = 0; i < 2000; i++) b = stepBounce(b, 0.016, 400, 300, 80);
    expect(b.y).toBe(220);
    expect(b.vy).toBe(0);
    expect(Math.abs(b.vx)).toBeLessThan(1);
  });
});

describe("parsePlacedItems", () => {
  it("知らない家具やおかしな位置は直す", () => {
    expect(parsePlacedItems([{ id: "sofa", x: 120, y: -5 }, { id: "ufo", x: 1, y: 1 }, "x"])).toEqual([{ id: "sofa", x: 100, y: 0 }]);
  });
});
