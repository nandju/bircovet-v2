"use client";

import ClivaLogo from "@/components/common/ClivaLogo";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import ConnectionToggle from "@/components/header/ConnectionToggle";
import EstablishmentSelector from "@/components/header/EstablishmentSelector";
import GlobalSearch from "@/components/header/GlobalSearch";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import QuickCreate from "@/components/header/QuickCreate";
import UserDropdown from "@/components/header/UserDropdown";
import { useDemo } from "@/context/DemoStoreContext";
import { useSidebar } from "@/context/SidebarContext";
import { Link } from "@/i18n/navigation";
import { CloseIcon, HorizontaLDots, ListIcon, WifiOffIcon } from "@/icons";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

const AppHeader: React.FC = () => {
  const t = useTranslations("header");
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { session, db, setOffline } = useDemo();
  const pending = db.syncQueue.filter((o) => o.status !== "synchronise").length;

  const handleToggle = () => {
    if (window.innerWidth >= 1280) toggleSidebar();
    else toggleMobileSidebar();
  };

  return (
    <header className="sticky top-0 z-9999 w-full border-gray-200 bg-white xl:border-b dark:border-gray-800 dark:bg-gray-900 print:hidden">
      <div className="flex grow flex-col items-center justify-between xl:flex-row xl:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:gap-4 xl:w-auto xl:justify-normal xl:border-b-0 xl:px-0 xl:py-3.5 dark:border-gray-800">
          <button
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border-gray-200 text-gray-500 lg:size-11 xl:border dark:border-gray-800 dark:text-gray-400 [&>svg]:size-5",
              isMobileOpen && "bg-gray-100 dark:bg-white/3",
            )}
            onClick={handleToggle}
            aria-label={t("toggleSidebar")}
          >
            {isMobileOpen ? <CloseIcon /> : <ListIcon className="rtl:-scale-x-100" />}
          </button>

          <Link href="/" className="xl:hidden" aria-label="Cliva">
            <ClivaLogo className="[&_svg]:size-8" />
          </Link>

          <button
            onClick={() => setApplicationMenuOpen((o) => !o)}
            aria-label="Afficher les actions"
            aria-expanded={isApplicationMenuOpen}
            className="flex size-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 xl:hidden dark:text-gray-400 dark:hover:bg-gray-800 [&>svg]:size-6"
          >
            <HorizontaLDots />
          </button>

          <GlobalSearch className="hidden xl:block" />
        </div>
        <div
          className={cn(
            "w-full flex-col gap-3 px-4 py-3 shadow-theme-md xl:flex xl:w-auto xl:flex-row xl:items-center xl:justify-end xl:px-0 xl:shadow-none",
            isApplicationMenuOpen ? "flex" : "hidden",
          )}
        >
          <GlobalSearch className="xl:hidden" />
          <div className="flex flex-wrap items-center justify-between gap-2 2xsm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <EstablishmentSelector />
              <ConnectionToggle />
            </div>
            <div className="flex items-center gap-2 2xsm:gap-3">
              <QuickCreate />
              <ThemeToggleButton />
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>
      {session.offline && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-warning-200 bg-warning-50 px-4 py-1.5 text-theme-xs font-medium text-warning-800 dark:border-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
          <WifiOffIcon className="size-4" />
          <span>{t("offline")}</span>
          {pending > 0 && <span>· {pending} opération(s) en attente de synchronisation</span>}
          <button onClick={() => setOffline(false)} className="underline underline-offset-2 hover:no-underline">
            Simuler le retour de connexion
          </button>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
