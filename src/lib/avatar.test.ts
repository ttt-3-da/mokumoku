import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, heatLevel, isItemAvailable, parseAvatar, seededRandom } from "./avatar";

describe("parseAvatar", () => {
  it("正しいパーツIDはそのまま使う", () => {
    const a = { color: "yuzu", eyes: "glasses", mouth: "frown", cheeks: "none", head: "crown", desk: "pet", hachimaki: "indigo", neck: "muffler", form: "triple" };
    expect(parseAvatar(a)).toEqual(a);
  });

  it("知らない値や欠けた値はデフォルトにする", () => {
    expect(parseAvatar({ color: "toString", eyes: 3 })).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR);
  });
});

describe("isItemAvailable", () => {
  it("解放制でないアイテムはいつでも使える", () => {
    expect(isItemAvailable("head:ribbon", new Set())).toBe(true);
  });
  it("解放制のアイテムは解放済みのときだけ使える", () => {
    expect(isItemAvailable("desk:mug", new Set())).toBe(false);
    expect(isItemAvailable("desk:mug", new Set(["desk:mug"]))).toBe(true);
  });
});

describe("seededRandom", () => {
  it("同じ seed なら同じ値、0〜1 の範囲", () => {
    const a = seededRandom("user-a", 1);
    expect(seededRandom("user-a", 1)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(seededRandom("user-b", 1)).not.toBe(a);
  });
});

describe("heatLevel", () => {
  it("1時間超で1、2時間超で2", () => {
    expect(heatLevel(60)).toBe(0);
    expect(heatLevel(61)).toBe(1);
    expect(heatLevel(121)).toBe(2);
  });
});
