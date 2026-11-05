"use client";

import { LogoMark } from "@/icons";
import { useDemo } from "@/context/DemoStoreContext";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { cn } from "@/utils";

/** Logo de la plateforme — reflète la personnalisation (nom, logo, slogan) des paramètres. */
export default function ClivaLogo({ compact = false, hideSlogan = false, className, light = false }: { compact?: boolean; hideSlogan?: boolean; className?: string; light?: boolean }) {
  const { db } = useDemo();
  const branding = db?.settings.branding ?? DEFAULT_BRANDING;
  const name = branding.platformName || DEFAULT_BRANDING.platformName;
  // Le slogan enregistré commence souvent par le nom (« Cliva — … ») : on évite la répétition sous le nom.
  const rawSlogan = branding.slogan || "La clinique vétérinaire qui avance avec vous.";
  const stripped = rawSlogan.replace(new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[—–:-]\\s*`, "i"), "");
  const slogan = stripped.charAt(0).toUpperCase() + stripped.slice(1);
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
        <span className="flex min-w-0 flex-col">
          <span className={cn("text-lg leading-tight font-bold tracking-wide", light ? "text-white" : "text-gray-900 dark:text-white")}>{name.toUpperCase()}</span>
          {!hideSlogan && slogan && (
            <span className={cn("line-clamp-2 max-w-44 text-[11px] leading-snug font-medium", light ? "text-white/70" : "text-gray-500 dark:text-gray-400")}>{slogan}</span>
          )}
        </span>
      )}
    </span>
  );
}
