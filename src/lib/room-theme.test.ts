import { describe, expect, it } from "vitest";
import { parseTheme, plantLevel, timeOfDay } from "./room-theme";

// 日本時間の hour 時を UTC のミリ秒にする
const jst = (hour: number) => Date.UTC(2026, 10, 12, hour - 9, 0, 0);

describe("timeOfDay", () => {
  it("日本時間で朝・昼・夕方・夜を判定する", () => {
    expect(timeOfDay(jst(5))).toBe("morning");
    expect(timeOfDay(jst(9))).toBe("morning");
    expect(timeOfDay(jst(10))).toBe("day");
    expect(timeOfDay(jst(16))).toBe("evening");
    expect(timeOfDay(jst(19))).toBe("night");
    expect(timeOfDay(jst(26))).toBe("night"); // 翌2時
  });
});

describe("parseTheme / plantLevel", () => {
  it("知らないテーマは図書館にする", () => {
    expect(parseTheme("space")).toBe("space");
    expect(parseTheme("toString")).toBe("library");
  });
  it("観葉植物は累計時間で育つ", () => {
    expect(plantLevel(50 * 60)).toBe(1);
    expect(plantLevel(75 * 60)).toBe(2);
    expect(plantLevel(100 * 60)).toBe(3);
  });
});
