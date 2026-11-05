"use client";

import { universe } from "@/lib/universe";
import ClivaLogo from "@/components/common/ClivaLogo";
import { useDemo } from "@/context/DemoStoreContext";
import { navBadges } from "./navBadges";
import { SIMPLE_MENU, useDisplayPrefs } from "@/hooks/useDisplayPrefs";
import { Link, usePathname } from "@/i18n/navigation";
import { ChevronDownIcon, HorizontaLDots } from "@/icons";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useSidebar } from "../context/SidebarContext";
import { NAV_GROUPS, type NavItem } from "./navigation";
import SidebarWidget from "./SidebarWidget";

const matches = (pathname: string, path: string) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { can, db, user } = useDemo();
  const [{ simple }] = useDisplayPrefs();
  const badges = navBadges(db, user);
  const Badge = (k: string) => (badges[k] ? <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-error-500 px-1.5 text-[11px] leading-5 font-semibold text-white" aria-label={`${badges[k]} à traiter`}>{badges[k]}</span> : null);
  const groupCount = (nav: NavItem) => (nav.subItems ?? []).reduce((n, s) => n + (badges[s.key] ?? 0), 0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const showText = isExpanded || isHovered || isMobileOpen;

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items
          .filter((it) => can(it.module) || (it.orModule && can(it.orModule)) || it.subItems?.some((s) => s.module && can(s.module)))
          .filter((it) => !simple || SIMPLE_MENU.has(it.key))
          .map((it) => ({ ...it, subItems: it.subItems?.filter((s) => can(s.module ?? it.module) && (!simple || SIMPLE_MENU.has(s.key))) })),
      })).filter((g) => g.items.length),
    [can, simple],
  );

  /** Sous-élément actif = préfixe le plus long correspondant à l'URL. */
  const activeSub = useMemo(() => {
    let best: string | null = null;
    for (const g of groups) for (const it of g.items) for (const s of it.subItems ?? []) if (matches(pathname, s.path) && (!best || s.path.length > best.length)) best = s.path;
    return best;
  }, [groups, pathname]);

  useEffect(() => {
    const parent = groups.flatMap((g) => g.items).find((it) => it.subItems?.some((s) => s.path === activeSub));
    setOpenKey(parent?.key ?? null);
  }, [activeSub, groups]);

  const renderItem = (nav: NavItem) => {
    const isOpen = openKey === nav.key;
    const parentActive = nav.subItems?.some((s) => s.path === activeSub);
    if (nav.subItems) {
      return (
        <li key={nav.key}>
          <button
            onClick={() => setOpenKey(isOpen ? null : nav.key)}
            className={cn("group menu-item cursor-pointer", isOpen || parentActive ? "menu-item-active" : "menu-item-inactive", !showText ? "xl:justify-center" : "xl:justify-start")}
            aria-expanded={isOpen}
            title={!showText ? t(`items.${nav.key}`) : undefined}
          >
            <span className={cn("[&>svg]:size-5.5", isOpen || parentActive ? "menu-item-icon-active" : "menu-item-icon-inactive")}>{nav.icon}</span>
            {showText && <span className="menu-item-text truncate">{t(`items.${nav.key}`)}</span>}
            {showText && !isOpen && groupCount(nav) > 0 && <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-error-500 px-1.5 text-[11px] leading-5 font-semibold text-white">{groupCount(nav)}</span>}
            {showText && <ChevronDownIcon className={cn(!isOpen && groupCount(nav) > 0 ? "ms-1" : "ms-auto", "size-5 shrink-0 transition-transform duration-200", isOpen && "rotate-180 text-brand-500")} />}
          </button>
          {showText && isOpen && (
            <ul className="ms-9 mt-1.5 space-y-0.5 border-s border-gray-100 ps-2 dark:border-gray-800">
              {nav.subItems.map((s) => (
                <li key={s.key}>
                  <Link href={s.path} className={cn("menu-dropdown-item py-2", activeSub === s.path ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive")}>
                    <span className="flex w-full items-center gap-2">{t(`items.${s.key}`)}{Badge(s.key)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    }
    const active = nav.path ? matches(pathname, nav.path) : false;
    return (
      <li key={nav.key}>
        <Link href={nav.path ?? "/"} className={cn("group menu-item", active ? "menu-item-active" : "menu-item-inactive", !showText && "xl:justify-center")} title={!showText ? t(`items.${nav.key}`) : undefined}>
          <span className={cn("[&>svg]:size-5.5", active ? "menu-item-icon-active" : "menu-item-icon-inactive")}>{nav.icon}</span>
          {showText && <span className="menu-item-text truncate">{t(`items.${nav.key}`)}</span>}
          {showText && Badge(nav.key)}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "fixed top-0 start-0 z-999999 flex h-dvh flex-col border-e border-gray-200/70 bg-white/90 backdrop-blur-md px-4 text-gray-900 transition-all duration-300 ease-in-out xl:z-50 dark:border-gray-800 dark:bg-gray-900 print:hidden",
        isExpanded || isMobileOpen || isHovered ? "w-72.5" : "w-22.5",
        isMobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        "xl:translate-x-0 xl:rtl:translate-x-0",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Navigation principale"
    >
      <div className={cn("flex shrink-0 py-6", !showText ? "xl:justify-center" : "justify-start ps-2")}>
        <Link href="/" aria-label="Cliva — Vue d'ensemble">
          <ClivaLogo compact={!showText} />
        </Link>
      </div>
      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto pb-6 duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key}>
                <h2 className={cn("mb-2 flex px-3 text-theme-xs leading-5 font-medium tracking-wide text-gray-400 uppercase", !showText ? "xl:justify-center xl:px-0" : "justify-start")}>
                  {showText ? (<span className="flex items-center gap-2"><span aria-hidden className={cn("size-1.5 rounded-full", universe(g.key).dot)} />{t(`groups.${g.key}`)}</span>) : <HorizontaLDots />}
                </h2>
                <ul className="flex flex-col gap-1">{g.items.map(renderItem)}</ul>
              </div>
            ))}
          </div>
        </nav>
        {showText ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
