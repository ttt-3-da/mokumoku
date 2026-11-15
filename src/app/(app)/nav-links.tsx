"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/login/actions";

function navLinks(username: string, isAdmin = false) {
  return [
    { href: "/lobby", label: "ロビー", icon: "🏠" },
    { href: "/timeline", label: "記録", icon: "📒" },
    { href: "/follows", label: "フォロー", icon: "🤝" },
    { href: "/users", label: "さがす", icon: "🔍" },
    { href: "/shop", label: "ショップ", icon: "🛍️" },
    { href: "/avatar", label: "着せかえ", icon: "👕" },
    { href: "/mochi", label: "もちの部屋", icon: "🏡" },
    { href: `/u/${username}`, label: "プロフィール", icon: "🙂" },
    { href: "/settings", label: "設定", icon: "⚙️" },
    ...(isAdmin ? [{ href: "/admin", label: "管理", icon: "🛠️" }] : []),
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 広い画面ではヘッダーに横並び。スマホ（縦持ち）では MobileMenu を使う */
export function NavLinks({ username, isAdmin = false }: { username: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メニュー"
      className="-mx-1 hidden min-w-0 gap-1 overflow-x-auto px-1 text-sm whitespace-nowrap [scrollbar-width:none] sm:flex"
    >
      {navLinks(username, isAdmin)
        .map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              data-tour={`nav-${l.href.slice(1)}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition ${active ? "bg-paper font-bold shadow-sm" : "text-ink-soft hover:bg-paper"}`}
            >
              {l.label}
            </Link>
          );
        })}
    </nav>
  );
}

/** スマホ用：☰ を押すと左からメニューが出る */
export function MobileMenu({ username, isAdmin = false }: { username: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // ヘッダー（backdrop-blur）の中に置くと fixed が画面全体にならないので、初めて開いたときに body 直下へ出す
  const [mounted, setMounted] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ページが変わったら閉じる
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      button?.focus();
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setMounted(true);
          // 閉じた位置で一度描いてから開くと、左からすべり出る
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setOpen(true)),
          );
        }}
        data-tour="menu"
        aria-label="メニューを開く"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-paper"
      >
        ☰
      </button>
      {mounted &&
        createPortal(
          <div className="sm:hidden">
            <div
              className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              id="mobile-menu"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="メニュー"
              inert={!open}
              className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-cream p-4 shadow-xl transition-transform duration-200 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-bold tracking-wide">
                  Mokumoku
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="メニューを閉じる"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-paper"
                >
                  ×
                </button>
              </div>
              <nav aria-label="メニュー" className="flex flex-col gap-1">
                {[...navLinks(username, isAdmin), { href: "/feedback", label: "ご意見・不具合", icon: "✉️" }].map((l) => {
                  const active = isActive(pathname, l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base ${active ? "bg-paper font-bold shadow-sm" : "hover:bg-paper"}`}
                    >
                      <span aria-hidden>{l.icon}</span>
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
              <form action={signOut} className="mt-auto border-t border-line pt-3">
                <button type="submit" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base text-ink-soft hover:bg-paper">
                  <span aria-hidden>🚪</span>
                  ログアウト
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
