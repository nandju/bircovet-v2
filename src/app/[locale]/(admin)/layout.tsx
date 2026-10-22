"use client";

import AccessDenied from "@/components/common/AccessDenied";
import MiniMarc from "@/components/mini-marc/MiniMarc";
import { SplashScreen, useDemo } from "@/context/DemoStoreContext";
import { useSidebar } from "@/context/SidebarContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { moduleForPath } from "@/layout/navigation";
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
  }, [user, router]);

  if (!user) return <SplashScreen label="Redirection vers la page de connexion…" />;

  const mod = moduleForPath(pathname);
  const allowed = !mod || can(mod);

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={cn("min-w-0 flex-1 transition-all duration-300 ease-in-out print:ms-0", isMobileOpen ? "ms-0" : isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5")}>
        <AppHeader />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4 md:p-6 print:p-0">{allowed ? <Suspense fallback={null}>{children}</Suspense> : <AccessDenied what={mod ? MODULE_LABELS[mod] : undefined} />}</main>
      </div>
      {allowed && <MiniMarc />}
    </div>
  );
}
