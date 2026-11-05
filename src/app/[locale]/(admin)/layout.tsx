"use client";

import AccessDenied from "@/components/common/AccessDenied";
import AlertCenter from "@/components/common/AlertCenter";
import MiniMarc from "@/components/mini-marc/MiniMarc";
import Watermark from "@/components/print/Watermark";
import WelcomeTour from "@/components/help/WelcomeTour";
import LicenceBanner from "@/components/platform/LicenceBanner";
import { SplashScreen, useDemo } from "@/context/DemoStoreContext";
import { useSidebar } from "@/context/SidebarContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { altModuleForPath, moduleForPath } from "@/layout/navigation";
import { MODULE_LABELS } from "@/lib/permissions";
import { cn } from "@/utils";
import React, { Suspense, useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { user, can } = useDemo();
  const router = useRouter();
  const pathname = usePathname();

  // Protection de navigation côté client (simulation — pas une sécurité réelle).
  useEffect(() => {
    if (!user) router.replace("/signin");
    // L'éditeur n'a accès qu'à sa console, jamais aux écrans d'une clinique.
    else if (user.roleId === "editeur" && !pathname.startsWith("/editeur")) router.replace("/editeur");
  }, [user, router, pathname]);

  if (!user) return <SplashScreen label="Redirection vers la page de connexion…" />;

  const mod = moduleForPath(pathname);
  const alt = altModuleForPath(pathname);
  const allowed = !mod || can(mod) || (!!alt && can(alt));

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={cn("min-w-0 flex-1 transition-all duration-300 ease-in-out print:ms-0", isMobileOpen ? "ms-0" : isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5")}>
        <AppHeader />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4 md:p-6 print:p-0">{allowed ? <Suspense fallback={null}>{children}</Suspense> : <AccessDenied what={mod ? MODULE_LABELS[mod] : undefined} />}</main>
      </div>
      {allowed && user.roleId !== "editeur" && <MiniMarc />}
      {user.roleId !== "editeur" && <AlertCenter />}
      <Watermark />
      {user.roleId !== "editeur" && <WelcomeTour />}
      {user.roleId === "dg" && <LicenceBanner />}
    </div>
  );
}
