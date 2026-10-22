"use client";

import { LogoMark } from "@/icons";
import { useDemo } from "@/context/DemoStoreContext";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { cn } from "@/utils";

/** Logo de la plateforme — reflète la personnalisation (nom, logo, slogan) des paramètres. */
export default function ClivaLogo({ compact = false, className, light = false }: { compact?: boolean; className?: string; light?: boolean }) {
  const { db } = useDemo();
  const branding = db?.settings.branding ?? DEFAULT_BRANDING;
  const name = branding.platformName || DEFAULT_BRANDING.platformName;
  const slogan = branding.slogan || "La clinique vétérinaire qui avance avec vous.";
  const logo = branding.logoDataUrl;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo personnalisé (data URL local)
        <img src={logo} alt={name} className="size-9 shrink-0 rounded-lg object-contain" />
      ) : (
        <LogoMark className="size-9 shrink-0" />
      )}
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-lg font-bold tracking-wide", light ? "text-white" : "text-gray-900 dark:text-white")}>{name.toUpperCase()}</span>
          <span className={cn("mt-0.5 text-[10px] font-medium tracking-[0.18em] uppercase", light ? "text-white/70" : "text-tertiary-600 dark:text-tertiary-400")}>{slogan}</span>
        </span>
      )}
    </span>
  );
}
