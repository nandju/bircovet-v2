"use client";

import BodyPortal from "@/components/common/BodyPortal";
import HeaderPopover from "@/components/header/HeaderPopover";
import { Link, usePathname } from "@/i18n/navigation";
import { helpFor } from "@/lib/help";
import { useState } from "react";
import { useTutorials } from "./HelpCenter";
import TutorialPlayer from "./TutorialPlayer";

/** Bouton « ? Aide » : explique la page en cours, avec ses tutoriels. */
export default function HelpButton() {
  const path = usePathname();
  const h = helpFor(path);
  const tutos = useTutorials().filter((t) => t.routes.some((r) => path === r || (r !== "/" && path.startsWith(`${r}/`))));
  const [open, setOpen] = useState<string | null>(null);
  const all = useTutorials();
  return (
    <>
      <HeaderPopover
        className="max-h-[75vh] overflow-y-auto sm:w-96"
        trigger={({ open: o, toggle }) => (
          <button onClick={toggle} aria-expanded={o} className="flex h-10 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 lg:h-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5" aria-label="Aide sur cette page">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">?</span>
            <span className="hidden xl:inline">Aide</span>
          </button>
        )}
      >
        {(close) => (
          <div className="space-y-3 p-3">
            {h ? (
              <>
                <div>
                  <p className="text-base font-semibold text-gray-800 dark:text-white/90">{h.title}</p>
                  <p className="text-theme-sm text-gray-600 dark:text-gray-400">{h.what}</p>
                </div>
                <ol className="space-y-1.5">
                  {h.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                {h.tip && <p className="rounded-xl bg-warning-50 px-3 py-2 text-theme-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">💡 {h.tip}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Pas encore d&apos;aide écrite pour cette page. Consultez les tutoriels.</p>
            )}
            {tutos.length > 0 && (
              <div className="space-y-1">
                <p className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">En vidéo</p>
                {tutos.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setOpen(t.id); close(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-brand-700 hover:bg-brand-25 dark:text-brand-300 dark:hover:bg-white/5">
                    <span aria-hidden>▶</span>
                    {t.title} <span className="text-theme-xs text-gray-500">· {t.minutes} min</span>
                  </button>
                ))}
              </div>
            )}
            <Link href="/aide" onClick={close} className="block rounded-xl bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-200 dark:bg-white/10 dark:text-white/90">
              Tous les tutoriels
            </Link>
          </div>
        )}
      </HeaderPopover>
      <BodyPortal>
        <TutorialPlayer t={all.find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} />
      </BodyPortal>
    </>
  );
}
