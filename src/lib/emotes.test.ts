import { describe, expect, it } from "vitest";
import { claimEmoteSlot, emoteGroups, EMOTES, parseEmoteEvent } from "./emotes";

describe("parseEmoteEvent", () => {
  it("知っているエモートだけ受け付ける", () => {
    expect(parseEmoteEvent({ id: "1", from: "a", emote: "wave" })).toEqual({ id: "1", from: "a", emote: "wave" });
    expect(parseEmoteEvent({ id: "1", from: "a", emote: "dance" })).toBeNull();
    expect(parseEmoteEvent({ id: "1", emote: "wave" })).toBeNull();
    expect(parseEmoteEvent("wave")).toBeNull();
  });
});

describe("claimEmoteSlot", () => {
  it("3秒に1回まで", () => {
    const last = { current: null as number | null };
    expect(claimEmoteSlot(last, 1000)).toBe(true);
    expect(claimEmoteSlot(last, 3999)).toBe(false);
    expect(claimEmoteSlot(last, 4000)).toBe(true);
  });
});

describe("emoteGroups", () => {
  it("あいさつ・気分・勉強の3グループに全部入る", () => {
    const groups = emoteGroups();
    expect(groups.map((g) => g.group)).toEqual(["あいさつ", "気分", "勉強"]);
    expect(groups.flatMap((g) => g.items)).toHaveLength(EMOTES.length);
  });
});
