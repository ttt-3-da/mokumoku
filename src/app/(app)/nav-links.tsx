"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ username }: { username: string }) {
  const pathname = usePathname();
  const links = [
    { href: "/lobby", label: "ロビー" },
    { href: "/timeline", label: "記録" },
    { href: `/u/${username}`, label: "プロフィール" },
  ];
  return (
    <nav className="flex gap-1 text-sm">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 transition ${
              active ? "bg-paper font-bold shadow-sm" : "text-ink-soft hover:bg-paper"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
