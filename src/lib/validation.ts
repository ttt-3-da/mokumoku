/**
 * 入力チェック。DB 側の CHECK 制約と同じルールをクライアント／サーバーでも使う。
 * 文字数は Postgres の char_length と揃えるため「コードポイント数」で数える
 * （絵文字1文字を2文字と数えないように）。
 */
import type { TimerMode, Visibility } from "@/lib/types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const ng = <T,>(error: string): Result<T> => ({ ok: false, error });

export function charLength(s: string): number {
  return [...s].length;
}

// ---------------------------------------------------------------- auth

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt の上限

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): Result<string> {
  const v = normalizeUsername(raw);
  if (!USERNAME_RE.test(v)) {
    return ng("ユーザーIDは英数字とアンダースコア（_）で3〜20文字にしてください");
  }
  return ok(v);
}

export function validatePassword(raw: string): Result<string> {
  if (raw.length < PASSWORD_MIN) return ng(`パスワードは${PASSWORD_MIN}文字以上にしてください`);
  if (raw.length > PASSWORD_MAX) return ng(`パスワードは${PASSWORD_MAX}文字以内にしてください`);
  return ok(raw);
}

export function validateDisplayName(raw: string): Result<string> {
  const v = raw.trim();
  const len = charLength(v);
  if (len < 1 || len > 30) return ng("表示名は1〜30文字にしてください");
  return ok(v);
}

// ---------------------------------------------------------------- rooms

export const ROOM_ICONS = ["📚", "✏️", "💻", "🧪", "🎨", "🎵", "🌙", "☕", "🧠", "📝", "🌱", "🏃"] as const;
export const MAX_TAGS = 5;
export const TAG_MAX_LENGTH = 15;

/** 「#英語, TOEIC　資格」のような入力をタグ配列にする（重複除去・#除去） */
export function parseTags(raw: string): string[] {
  const tags = raw
    .split(/[,、\s　]+/)
    .map((t) => t.replace(/^#+/, "").trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

export type RoomInput = {
  name: string;
  description: string;
  icon: string;
  tags: string[];
  visibility: Visibility;
  capacity: number;
  timer_mode: TimerMode;
  focus_minutes: number;
  break_minutes: number;
  is_persistent: boolean;
};

const VISIBILITIES: Visibility[] = ["public", "unlisted", "approval"];
const TIMER_MODES: TimerMode[] = ["pomodoro", "free"];

function intInRange(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function validateRoomInput(input: {
  name: string;
  description: string;
  icon: string;
  tags: string;
  visibility: string;
  capacity: unknown;
  timer_mode: string;
  focus_minutes: unknown;
  break_minutes: unknown;
  is_persistent: boolean;
}): Result<RoomInput> {
  const name = input.name.trim();
  if (charLength(name) < 1 || charLength(name) > 40) return ng("部屋名は1〜40文字にしてください");

  const description = input.description.trim();
  if (charLength(description) > 200) return ng("説明は200文字以内にしてください");

  if (!(ROOM_ICONS as readonly string[]).includes(input.icon)) return ng("アイコンを選んでください");

  const tags = parseTags(input.tags);
  if (tags.length > MAX_TAGS) return ng(`タグは${MAX_TAGS}個までです`);
  if (tags.some((t) => charLength(t) > TAG_MAX_LENGTH)) {
    return ng(`タグは1つ${TAG_MAX_LENGTH}文字以内にしてください`);
  }

  if (!VISIBILITIES.includes(input.visibility as Visibility)) return ng("公開範囲が不正です");
  if (!TIMER_MODES.includes(input.timer_mode as TimerMode)) return ng("モードが不正です");

  const capacity = intInRange(input.capacity, 2, 20);
  if (capacity === null) return ng("定員は2〜20人にしてください");

  const focus = intInRange(input.focus_minutes, 5, 90);
  const brk = intInRange(input.break_minutes, 1, 30);
  if (input.timer_mode === "pomodoro") {
    if (focus === null) return ng("集中時間は5〜90分にしてください");
    if (brk === null) return ng("休憩時間は1〜30分にしてください");
  }

  return ok({
    name,
    description,
    icon: input.icon,
    tags,
    visibility: input.visibility as Visibility,
    capacity,
    timer_mode: input.timer_mode as TimerMode,
    // 自由モードでも列は NOT NULL なので既定値を入れておく
    focus_minutes: focus ?? 25,
    break_minutes: brk ?? 5,
    is_persistent: input.is_persistent,
  });
}

// ---------------------------------------------------------------- sessions / posts

export const TASK_MAX = 60;
export const NOTE_MAX = 280;

export function validateTask(raw: string): Result<string> {
  const v = raw.trim();
  const len = charLength(v);
  if (len < 1) return ng("「今からやること」を入力してください");
  if (len > TASK_MAX) return ng(`「今からやること」は${TASK_MAX}文字以内にしてください`);
  return ok(v);
}

export function validateNote(raw: string): Result<string> {
  const v = raw.trim();
  if (charLength(v) > NOTE_MAX) return ng(`メモは${NOTE_MAX}文字以内にしてください`);
  return ok(v);
}
