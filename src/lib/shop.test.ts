import { describe, expect, it } from "vitest";
import { COLORS } from "./avatar";
import { coinsShort, formatCoins, parseShopSort, sortShopItems } from "./shop";

describe("formatCoins", () => {
  it("管理者の無限のコインは ∞、ふつうは数", () => {
    expect(formatCoins(1_000_000_000)).toBe("∞");
    expect(formatCoins(999_999_500)).toBe("∞");
    expect(formatCoins(120)).toBe("120");
  });
});

const items = [
  { item_id: "color:a", price: 50, sort_order: 2, released_at: "2026-11-01T00:00:00Z" },
  { item_id: "color:b", price: 10, sort_order: 3, released_at: "2026-11-13T00:00:00Z" },
  { item_id: "color:c", price: 150, sort_order: 1, released_at: "2026-11-10T00:00:00Z" },
];

describe("sortShopItems", () => {
  const ids = (mode: Parameters<typeof sortShopItems>[2], owned = new Set<string>()) =>
    sortShopItems(items, owned, mode).map((i) => i.item_id);

  it("おすすめ・安い・高い・新しい順に並べられる", () => {
    expect(ids("recommended")).toEqual(["color:c", "color:a", "color:b"]);
    expect(ids("cheap")).toEqual(["color:b", "color:a", "color:c"]);
    expect(ids("expensive")).toEqual(["color:c", "color:a", "color:b"]);
    expect(ids("newest")).toEqual(["color:b", "color:c", "color:a"]);
  });

  it("持っていないものを先に出せる。元の配列は変えない", () => {
    expect(ids("unowned", new Set(["color:c"]))).toEqual(["color:a", "color:b", "color:c"]);
    expect(items[0].item_id).toBe("color:a");
  });

  it("知らない並び順はおすすめ順にする", () => {
    expect(parseShopSort("random")).toBe("recommended");
    expect(parseShopSort("cheap")).toBe("cheap");
  });
});

describe("coinsShort", () => {
  it("足りないぶんを返す", () => {
    expect(coinsShort(30, 50)).toBe(20);
    expect(coinsShort(80, 50)).toBe(0);
  });
});

describe("COLORS", () => {
  it("体の色は38種（無料3＋今までの有料5＋新しく30）", () => {
    expect(Object.keys(COLORS)).toHaveLength(38);
  });
  it("塗り分けの色は2色以上ある", () => {
    for (const c of Object.values(COLORS)) {
      if (c.paint) expect(c.paint.stops.length).toBeGreaterThanOrEqual(2);
    }
  });
});
