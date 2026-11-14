import { describe, expect, it } from "vitest";
import { canUseEmote, EMOTES } from "./emotes";
import { isFreeStamp, STAMPS, usableStamps } from "./stamps";

describe("stamps", () => {
  it("スタンプ20種・エモート20種", () => {
    expect(STAMPS).toHaveLength(20);
    expect(EMOTES).toHaveLength(20);
  });
  it("無料のものと買ったものだけ使える", () => {
    expect(STAMPS.filter((s) => isFreeStamp(s.id)).map((s) => s.id)).toEqual(["clap", "ganbare"]);
    expect(usableStamps(["stamp:crown", "color:mint"]).map((s) => s.id)).toEqual(["clap", "ganbare", "crown"]);
    const owned = new Set(["emote:spin"]);
    expect(canUseEmote("wave", owned)).toBe(true);
    expect(canUseEmote("spin", owned)).toBe(true);
    expect(canUseEmote("nod", owned)).toBe(false);
  });
});
