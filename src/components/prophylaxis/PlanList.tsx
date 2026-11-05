"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate } from "@/lib/format";
import { PLAN_STATUS, planProgress, planTarget, STEP_STATE, stepState } from "@/lib/prophylaxis";
import type { ProphylaxisPlan } from "@/lib/types";
import { cn } from "@/utils";

/** Cartes des programmes appliqués : avancement et prochaine action. */
export default function PlanList({ plans, onOpen, empty = "Aucun programme appliqué." }: { plans: ProphylaxisPlan[]; onOpen: (id: string) => void; empty?: string }) {
  const { db, today } = useDemo();
  if (!plans.length) return <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">{empty}</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {plans.map((p) => {
        const pr = planProgress(p);
        const late = p.steps.filter((s) => s.status === "a_faire" && s.dueDate < today).length;
        const st = pr.next ? stepState(pr.next, today) : null;
        return (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p.id)} className="cliva-press flex w-full flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-start shadow-cliva hover:border-brand-300 dark:border-gray-800 dark:bg-white/3">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-theme-xs text-gray-500">{p.code} · depuis le {formatDate(p.startDate)}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90"><SpeciesIcon species={p.species} />{p.name}</span>
                  <span className="block truncate text-theme-sm text-gray-600 dark:text-gray-400">{planTarget(db, p)}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PLAN_STATUS[p.status].tone)}>{PLAN_STATUS[p.status].label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${pr.pct}%` }} /></span>
                <span className="text-theme-xs tabular-nums text-gray-500">{pr.done}/{pr.total}</span>
              </span>
              {p.status === "en_cours" && pr.next && st && (
                <span className="flex flex-wrap items-center gap-1.5 text-theme-sm">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STEP_STATE[st].tone)}>{STEP_STATE[st].label}</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatDate(pr.next.dueDate)} · {pr.next.label}</span>
                  {late > 1 && <span className="text-theme-xs font-medium text-error-600">{late} actions en retard</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
