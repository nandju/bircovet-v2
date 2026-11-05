"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import { useDemo } from "@/context/DemoStoreContext";
import { clientName } from "@/lib/calc";
import { careDue, careTarget, CARE_REASON, CARE_STATUS } from "@/lib/care";
import { formatDate } from "@/lib/format";
import type { CareCase } from "@/lib/types";
import { cn } from "@/utils";

export default function CareList({ cases, onOpen, showFarm }: { cases: CareCase[]; onOpen: (id: string) => void; showFarm?: boolean }) {
  const { db, today } = useDemo();
  if (!cases.length) return <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Aucune prise en charge.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {cases.map((c) => {
        const f = db.farms.find((x) => x.id === c.farmId);
        const due = careDue(c, today);
        const last = c.followUps[c.followUps.length - 1];
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onOpen(c.id)} className={cn("cliva-press flex w-full gap-3 rounded-2xl border bg-white p-3 text-start shadow-cliva dark:bg-white/3", due ? "border-orange-300 dark:border-orange-500/40" : "border-gray-200/70 dark:border-gray-800")}>
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl dark:bg-orange-500/10"><SpeciesIcon species={c.species} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", CARE_STATUS[c.status].tone)}>{CARE_STATUS[c.status].label}</span>
                  {due && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">Nouvelles à prendre</span>}
                  <span className="text-theme-xs text-gray-500">{c.code} · {formatDate(c.openedAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-gray-800 dark:text-white/90">{careTarget(db, c)}</span>
                <span className="block truncate text-theme-xs text-gray-500">{showFarm && f ? `${f.name} (${clientName(db, f.clientId)}) · ` : ""}{CARE_REASON[c.reason].label}{c.diagnosis ? ` · ${c.diagnosis}` : ""}</span>
                <span className="block truncate text-theme-xs text-gray-500">{last ? `Dernières nouvelles ${formatDate(last.date)} : ${last.note}` : c.status === "en_cours" && c.nextCheck ? `Prochaines nouvelles le ${formatDate(c.nextCheck)}` : c.outcome ?? ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
