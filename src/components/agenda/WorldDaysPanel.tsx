"use client";

import Panel from "@/components/common/Panel";
import { CopyButton } from "@/components/crm/followup/FollowUpModals";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate } from "@/lib/format";
import { postDraft, upcomingWorldDays, WORLD_DAY_CATS, type WorldDayCat } from "@/lib/worldDays";
import { cn } from "@/utils";
import { useState } from "react";

/**
 * Prochaines journées mondiales et fêtes, avec une idée de publication
 * et un texte prêt à copier pour la page du cabinet.
 */
export default function WorldDaysPanel({ className, horizon = 45, limit = 8, compact = false }: { className?: string; horizon?: number; limit?: number; compact?: boolean }) {
  const { db, today } = useDemo();
  const [cats, setCats] = useState<WorldDayCat[]>(["animaux", "veterinaire", "alimentation", "sante", "fete"]);
  const [open, setOpen] = useState<string | null>(null);
  const list = upcomingWorldDays(today, horizon, cats).slice(0, limit);
  const clinic = db.settings.clinicName || "vétérinaire";
  const toggle = (c: WorldDayCat) => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  return (
    <Panel className={className} title="Journées mondiales et fêtes à venir">
      <p className="-mt-2 px-4 pb-3 text-theme-xs text-gray-500">Idées de publications pour la page du cabinet ; touchez une journée pour le texte prêt à copier.</p>
      {!compact && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {(Object.keys(WORLD_DAY_CATS) as WorldDayCat[]).map((c) => (
            <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={cn("cliva-press inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-theme-xs", cats.includes(c) ? "border-transparent " + WORLD_DAY_CATS[c].chip : "border-gray-200 text-gray-500 dark:border-gray-700")}>
              <span className={cn("size-1.5 rounded-full", WORLD_DAY_CATS[c].dot)} />
              {WORLD_DAY_CATS[c].label}
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {list.map((w) => {
          const days = Math.round((new Date(`${w.date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
          const draft = postDraft(w, clinic);
          return (
            <li key={w.id} className="px-4 py-2.5">
              <button type="button" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id} className="flex w-full items-center gap-3 text-start">
                <span className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] leading-none font-medium", WORLD_DAY_CATS[w.cat].chip)}>
                  <span className="text-sm font-semibold">{w.date.slice(8, 10)}</span>
                  {new Date(`${w.date}T00:00:00`).toLocaleDateString("fr-FR", { month: "short" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{w.title}</span>
                  <span className="block text-theme-xs text-gray-500">{WORLD_DAY_CATS[w.cat].label} · {days <= 0 ? (w.end > w.date ? "en cours" : "aujourd'hui") : days === 1 ? "demain" : `dans ${days} jours`}{w.end > w.date ? ` · jusqu'au ${formatDate(w.end)}` : ""}</span>
                </span>
              </button>
              {open === w.id && (
                <div className="cliva-fade mt-2 ms-13 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
                  <p className="text-theme-xs font-medium tracking-wide text-gray-500 uppercase">Idée de publication</p>
                  <p className="mt-1">{w.idea}</p>
                  <textarea readOnly id={`wd-${w.id}`} value={draft} rows={4} className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-2 text-theme-xs dark:border-gray-700 dark:bg-gray-900" />
                  <div className="mt-1 flex justify-end">
                    <CopyButton text={draft} targetId={`wd-${w.id}`} label="Copier le texte" />
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Aucune journée dans les {horizon} prochains jours.</li>}
      </ul>
    </Panel>
  );
}
