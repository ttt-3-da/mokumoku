import { describe, expect, it } from "vitest";
import { addDays, grassLevel, grassWeeks, shortDate } from "./stats";

describe("addDays", () => {
  it("月・年をまたいでも正しく足す", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-12", -12)).toBe("2026-10-31");
  });
});

describe("grassLevel", () => {
  it("学習時間で濃さを5段階にする", () => {
    expect([0, 1, 30, 60, 120].map(grassLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("grassWeeks", () => {
  it("月曜始まりで週ごとに並べ、未来の日は null", () => {
    const weeks = grassWeeks("2026-11-02", "2026-11-12", { "2026-11-12": 45 }, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0]).toEqual({ date: "2026-11-02", minutes: 0 });
    expect(weeks[1][3]).toEqual({ date: "2026-11-12", minutes: 45 }); // 2週目の木曜
    expect(weeks[1][4]).toBeNull();
  });
});

describe("shortDate", () => {
  it("月/日 にする", () => {
    expect(shortDate("2026-01-05")).toBe("1/5");
  });
});
