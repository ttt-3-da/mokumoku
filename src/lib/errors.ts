/**
 * DB 関数（RPC）は `raise exception 'room_full'` のように短いコードを投げる。
 * それを画面に出す日本語に変換する。
 */
const MESSAGES: Record<string, string> = {
  not_authenticated: "ログインしてください",
  room_not_found: "部屋が見つかりません",
  room_closed: "この部屋はもう閉じられています",
  room_full: "満員のため入室できません",
  banned: "この部屋には入室できません",
  invite_required: "この部屋は招待URLからのみ入室できます",
  approval_pending: "オーナーの承認待ちです",
  invalid_task: "「今からやること」は1〜60文字で入力してください",
  no_active_session: "入室中のセッションがありません",
  session_not_found: "記録が見つかりません",
  session_not_ended: "まだ退室していません",
  invalid_note: "メモは280文字以内にしてください",
  item_locked: "まだ解放されていないアイテムです",
  invalid_avatar: "選べないパーツが含まれています",
  forbidden: "この操作はオーナー・モデレーターだけができます",
  request_not_found: "申請が見つかりません（取り下げられたか、すでに処理されています）",
  not_pomodoro_room: "この部屋はポモドーロモードではありません",
  ng_word: "部屋名か説明文に使えない言葉が含まれています",
  cannot_target_self: "自分自身には使えません",
  cannot_target_owner: "オーナーにはキック・BANを使えません",
  cannot_target_moderator: "モデレーターをキック・BANできるのはオーナーだけです",
  not_in_room: "その人はもう部屋にいません",
  owner_only: "この操作はオーナーだけができます",
  not_member: "その人はこの部屋のメンバーではありません",
};

export function rpcErrorMessage(error: { message?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  return MESSAGES[code] ?? "エラーが発生しました。時間をおいてもう一度お試しください";
}
