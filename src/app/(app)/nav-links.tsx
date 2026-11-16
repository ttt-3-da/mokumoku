"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/login/actions";

const MAIN_LINKS = [
  { href: "/lobby", label: "ロビー", icon: "🏠" },
  { href: "/todo", label: "ToDo", icon: "✅" },
  { href: "/timeline", label: "記録", icon: "📒" },
  { href: "/follows", label: "フォロー", icon: "🤝" },
  { href: "/users", label: "さがす", icon: "🔍" },
  { href: "/shop", label: "ショップ", icon: "🛍️" },
  { href: "/avatar", label: "着せかえ", icon: "👕" },
  { href: "/mochi", label: "もちの部屋", icon: "🏡" },
];

/** パソコンでは右上の「🙂」の中に入れるもの */
function accountLinks(username: string, isAdmin = false) {
  return [
    { href: `/u/${username}`, label: "プロフィール", icon: "🙂" },
    { href: "/settings", label: "設定", icon: "⚙️" },
    ...(isAdmin ? [{ href: "/admin", label: "管理", icon: "🛠️" }] : []),
  ];
}

function navLinks(username: string, isAdmin = false) {
  return [...MAIN_LINKS, ...accountLinks(username, isAdmin)];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 広い画面ではヘッダーに横並び。それより狭いときは MobileMenu を使う */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="メニュー" className="hidden min-w-0 gap-0.5 text-sm whitespace-nowrap lg:flex">
      {MAIN_LINKS
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

/** パソコン用：右上の「🙂」を押すと、プロフィール・設定などが出る */
export function AccountMenu({ username, isAdmin = false }: { username: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const boxRef = useRef<HTMLDivElement>(null);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [...accountLinks(username, isAdmin), { href: "/feedback", label: "ご意見・不具合", icon: "✉️" }];
  const here = links.some((l) => isActive(pathname, l.href));

  return (
    <div ref={boxRef} className="relative hidden shrink-0 lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="アカウントのメニュー"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm ${here || open ? "bg-paper shadow-sm" : "text-ink-soft hover:bg-paper"}`}
      >
        <span aria-hidden>🙂</span>
        <span aria-hidden className="text-[10px]">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 flex w-52 flex-col gap-0.5 rounded-2xl border border-line bg-paper p-2 shadow-lg">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
             
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${isActive(pathname, l.href) ? "bg-cream font-bold" : "hover:bg-cream"}`}
            >
              <span aria-hidden>{l.icon}</span>
              {l.label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-cream">
              <span aria-hidden>🚪</span>
              ログアウト
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** スマホ・せまい画面用：☰ を押すと左からメニューが出る */
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
    <div className="lg:hidden">
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
          <div className="lg:hidden">
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
