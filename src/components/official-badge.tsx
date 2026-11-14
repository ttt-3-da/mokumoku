/** 公式（運営）アカウントのマーク */
export function OfficialBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-1.5 align-middle text-[10px] font-bold leading-4 text-white ${className}`}
      title="Mokumoku の公式アカウント"
      aria-label="公式"
    >
      <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden>
        <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      公式
    </span>
  );
}
