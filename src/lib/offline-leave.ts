/** 電源が切れたときなど、画面からの知らせが止まってから退室にするまでの分。DB の profiles.offline_leave_minutes と合わせる */
export const OFFLINE_LEAVE_CHOICES = [1, 5, 10, 15, 20, 25, 30] as const;
export const OFFLINE_LEAVE_DEFAULT = 5;

export function parseOfflineLeave(v: unknown): number | null {
  const n = Number(v);
  return (OFFLINE_LEAVE_CHOICES as readonly number[]).includes(n) ? n : null;
}
