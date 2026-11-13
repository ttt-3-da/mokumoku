import { describe, expect, it } from "vitest";
import {
  charLength,
  parseTags,
  validateDisplayName,
  validatePassword,
  validateBio,
  validateNote,
  validateRoomInput,
  validateTask,
  validateUsername,
} from "./validation";
import { safeNextPath } from "./auth/next-path";
import { usernameToEmail } from "./auth/username-email";

describe("validateUsername", () => {
  it("小文字に正規化して受け付ける", () => {
    expect(validateUsername("  Moch_1 ")).toEqual({ ok: true, value: "moch_1" });
  });
  it.each(["ab", "a".repeat(21), "もち", "has-dash", "has space"])("%s は不可", (v) => {
    expect(validateUsername(v).ok).toBe(false);
  });
  it("ダミーメールアドレスに変換できる", () => {
    expect(usernameToEmail("mochi")).toBe("mochi@users.mokumoku.invalid");
  });
});

describe("validatePassword / validateDisplayName", () => {
  it("パスワードは8文字以上", () => {
    expect(validatePassword("1234567").ok).toBe(false);
    expect(validatePassword("12345678").ok).toBe(true);
  });
  it("表示名は前後の空白を除いて1〜30文字", () => {
    expect(validateDisplayName("   ").ok).toBe(false);
    expect(validateDisplayName(" もち ")).toEqual({ ok: true, value: "もち" });
    expect(validateDisplayName("あ".repeat(31)).ok).toBe(false);
  });
});

describe("charLength", () => {
  it("絵文字をコードポイント単位で数える（Postgres の char_length と同じ）", () => {
    expect("📚".length).toBe(2);
    expect(charLength("📚")).toBe(1);
  });
});

describe("parseTags", () => {
  it("カンマ・読点・空白で区切り、# と重複を除く", () => {
    expect(parseTags("#英語, TOEIC、資格　英語")).toEqual(["英語", "TOEIC", "資格"]);
  });
  it("空文字は空配列", () => {
    expect(parseTags("  ")).toEqual([]);
  });
});

const baseRoom = {
  name: "朝活もくもく",
  description: "",
  icon: "📚",
  tags: "朝活",
  visibility: "public",
  capacity: "10",
  timer_mode: "pomodoro",
  focus_minutes: "25",
  break_minutes: "5",
  is_persistent: true,
};

describe("validateRoomInput", () => {
  it("正しい入力を数値に変換する", () => {
    const r = validateRoomInput(baseRoom);
    expect(r.ok && r.value).toMatchObject({ capacity: 10, focus_minutes: 25, tags: ["朝活"] });
  });
  it.each([
    [{ name: "" }, "部屋名"],
    [{ name: "あ".repeat(41) }, "部屋名"],
    [{ description: "あ".repeat(201) }, "説明"],
    [{ icon: "💩" }, "アイコン"],
    [{ tags: "a b c d e f" }, "タグ"],
    [{ capacity: "1" }, "定員"],
    [{ capacity: "21" }, "定員"],
    [{ capacity: "2.5" }, "定員"],
    [{ focus_minutes: "4" }, "集中"],
    [{ break_minutes: "31" }, "休憩"],
    [{ visibility: "secret" }, "公開範囲"],
  ])("%o はエラー（%s）", (patch, word) => {
    const r = validateRoomInput({ ...baseRoom, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(word);
  });
  it("自由モードではタイマー分数を検証せず既定値を入れる", () => {
    const r = validateRoomInput({ ...baseRoom, timer_mode: "free", focus_minutes: "", break_minutes: "" });
    expect(r.ok && r.value).toMatchObject({ focus_minutes: 25, break_minutes: 5 });
  });
});

describe("validateTask / validateNote", () => {
  it("やることは1〜60文字", () => {
    expect(validateTask(" ").ok).toBe(false);
    expect(validateTask("英単語".padEnd(60, "あ")).ok).toBe(true);
    expect(validateTask("あ".repeat(61)).ok).toBe(false);
  });
  it("ひとことは空でもよく、280文字まで", () => {
    expect(validateNote("").ok).toBe(true);
    expect(validateNote("あ".repeat(281)).ok).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    [null, "/lobby"],
    ["https://evil.example", "/lobby"],
    ["//evil.example", "/lobby"],
    ["/\\evil.example", "/lobby"],
    ["/login", "/lobby"],
    ["/rooms/abc", "/rooms/abc"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("validateBio", () => {
  it("500文字まで。空でもよい", () => {
    expect(validateBio("").ok).toBe(true);
    expect(validateBio("あ".repeat(500)).ok).toBe(true);
    expect(validateBio("あ".repeat(501)).ok).toBe(false);
  });
});