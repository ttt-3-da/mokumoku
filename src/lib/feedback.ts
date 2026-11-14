export const FEEDBACK_KINDS = { bug: "不具合", request: "要望", other: "その他" } as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;
export const FEEDBACK_MAX = 1000;

export function feedbackKindLabel(kind: string): string {
  return Object.hasOwn(FEEDBACK_KINDS, kind) ? FEEDBACK_KINDS[kind as FeedbackKind] : kind;
}
