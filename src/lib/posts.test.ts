import { describe, expect, it } from "vitest";
import { isPostStamp, parseFeedTab, toggleReaction } from "./posts";

describe("posts", () => {
  it("投稿に使えるのは4つのもちスタンプだけ", () => {
    expect(isPostStamp("clap")).toBe(true);
    expect(isPostStamp("coffee")).toBe(false);
  });
  it("タブは following か all", () => {
    expect(parseFeedTab("all")).toBe("all");
    expect(parseFeedTab("x")).toBe("following");
  });
  it("押すと数が増え、取り消すと減って0ならなくなる", () => {
    const on = toggleReaction([], "clap", true);
    expect(on).toEqual([{ stamp_id: "clap", count: 1, reacted: true }]);
    expect(toggleReaction(on, "clap", false)).toEqual([]);
    expect(toggleReaction([{ stamp_id: "wow", count: 2, reacted: false }], "wow", true)).toEqual([{ stamp_id: "wow", count: 3, reacted: true }]);
  });
});
