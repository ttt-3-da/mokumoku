import { describe, expect, it } from "vitest";
import { CARD_GLYPHS, parseSharedSession, shareText, xIntentUrl } from "./share";

describe("share", () => {
  it("記録カードの中身を読む（壊れていたら null）", () => {
    const s = parseSharedSession({ display_name: "もち", avatar: null, minutes: 75, pomodoros: 3, todos_done: 2, ended_at: "2026-11-19T12:00:00Z" });
    expect(s).toMatchObject({ displayName: "もち", minutes: 75, pomodoros: 3, todosDone: 2 });
    expect(parseSharedSession(null)).toBeNull();
    expect(parseSharedSession({ minutes: 3 })).toBeNull();
  });

  it("投稿の文に勉強した時間とハッシュタグが入る", () => {
    const t = shareText(135);
    expect(t).toContain("2時間15分勉強しました");
    expect(t).toContain("#Mokumoku");
  });

  it("X の投稿画面のリンクをつくる", () => {
    const u = new URL(xIntentUrl("こんにちは #Mokumoku", "https://example.com/s/abc"));
    expect(u.origin).toBe("https://x.com");
    expect(u.searchParams.get("text")).toBe("こんにちは #Mokumoku");
    expect(u.searchParams.get("url")).toBe("https://example.com/s/abc");
  });

  it("画像に出す字は、勉強した時間の書き方をすべてふくむ", () => {
    for (const ch of "12時間34分勉強しました") expect(CARD_GLYPHS).toContain(ch);
  });
});
