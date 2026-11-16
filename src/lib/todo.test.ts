import { describe, expect, it } from "vitest";
import { groupDoneByDay, jstDay, type Todo } from "./todo";

const t = (id: string, done_at: string | null): Todo => ({ id, title: id, done_at, created_at: "2026-11-01T00:00:00Z" });

describe("todo", () => {
  it("日本時間の日付にする", () => {
    expect(jstDay("2026-11-15T15:30:00Z")).toBe("2026-11-16");
    expect(jstDay("2026-11-15T14:30:00Z")).toBe("2026-11-15");
  });

  it("終わったものだけを、日ごとに新しい順でまとめる", () => {
    const groups = groupDoneByDay([t("a", "2026-11-14T01:00:00Z"), t("b", null), t("c", "2026-11-15T03:00:00Z"), t("d", "2026-11-15T01:00:00Z")]);
    expect(groups.map((g) => g.day)).toEqual(["2026-11-15", "2026-11-14"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["d", "c"]);
  });
});
