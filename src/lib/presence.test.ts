import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR } from "./avatar";
import { flattenPresence, resolveStatus } from "./presence";
import type { PresenceMeta } from "./types";

const meta = (p: Partial<PresenceMeta>): PresenceMeta => ({
  userId: "u1",
  displayName: "もち",
  task: "英単語",
  status: "focus",
  joinedAt: "2026-11-12T09:00:00.000Z",
  avatar: DEFAULT_AVATAR,
  stopwatch: null,
  plantLevel: 1,
  updatedAt: 1,
  ...p,
});

describe("flattenPresence", () => {
  it("同じユーザーの複数タブは updatedAt が最新のものを採用する", () => {
    const state = {
      u1: [meta({ task: "古いタブ", updatedAt: 1 }), meta({ task: "新しいタブ", updatedAt: 5 })],
    };
    expect(flattenPresence(state)).toEqual([meta({ task: "新しいタブ", updatedAt: 5 })]);
  });

  it("入室時刻の順に並べる", () => {
    const state = {
      b: [meta({ userId: "b", joinedAt: "2026-11-12T09:10:00.000Z" })],
      a: [meta({ userId: "a", joinedAt: "2026-11-12T09:05:00.000Z" })],
    };
    expect(flattenPresence(state).map((m) => m.userId)).toEqual(["a", "b"]);
  });

  it("形の合わないデータは無視する（他クライアントからの不正な track 対策）", () => {
    const state = { x: [{ userId: "x" }, null, "str"], u1: [meta({})] };
    expect(flattenPresence(state as Record<string, unknown[]>)).toHaveLength(1);
  });

  it("アバターが壊れていてもデフォルトのもちで表示する", () => {
    const state = { u1: [{ ...meta({}), avatar: { color: "rainbow", eyes: "smile" } }] };
    const [m] = flattenPresence(state as Record<string, unknown[]>);
    expect(m.avatar).toEqual({ ...DEFAULT_AVATAR, eyes: "smile" });
  });
});

describe("resolveStatus", () => {
  it("タブが非表示なら離席中", () => {
    expect(resolveStatus({ hidden: true, timerPhase: "break" })).toBe("away");
  });
  it("休憩フェーズなら休憩中、それ以外は集中中", () => {
    expect(resolveStatus({ hidden: false, timerPhase: "break" })).toBe("break");
    expect(resolveStatus({ hidden: false, timerPhase: "focus" })).toBe("focus");
    expect(resolveStatus({ hidden: false, timerPhase: "idle" })).toBe("focus");
  });
});
