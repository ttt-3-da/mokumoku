import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none transition focus:border-accent focus:ring-2 focus:ring-sakura/40 disabled:opacity-60";

const buttonVariants = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-paper hover:bg-cream",
  ghost: "text-ink-soft hover:bg-cream",
  danger: "bg-red-500 text-white hover:bg-red-600",
} as const;

type Variant = keyof typeof buttonVariants;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-3xl border border-line bg-paper p-5 shadow-sm ${className}`} {...props} />;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-ink-soft">#{children}</span>;
}
