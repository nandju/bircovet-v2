import ClivaLogo from "@/components/common/ClivaLogo";
import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import React from "react";

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const features = ["Agenda, accueil et file d'attente", "Dossiers patients, consultations et hospitalisation", "Pharmacie, lots, péremptions et achats", "Facturation en FCFA, caisse et Mobile Money (simulés)"];
  return (
    <div className="relative z-1 bg-white dark:bg-gray-900">
      <div className="relative flex min-h-dvh w-full flex-col justify-center lg:flex-row">
        {children}
        <div className="relative hidden w-full items-center overflow-hidden bg-brand-900 lg:grid lg:w-1/2 dark:bg-white/5">
          <GridShape />
          <div className="relative z-1 mx-auto flex max-w-md flex-col items-start px-10">
            <ClivaLogo light className="[&_svg]:size-12" />
            <p className="mt-6 text-2xl leading-snug font-semibold text-white">{t("tagline")}</p>
            <ul className="mt-6 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="size-2 rounded-full bg-secondary-400" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-10 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-theme-xs text-white/70">
              Environnement de démonstration frontend : toutes les données sont fictives et restent dans ce navigateur.
            </p>
          </div>
        </div>
        <div className="fixed end-6 bottom-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
