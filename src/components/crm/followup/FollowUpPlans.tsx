"use client";

import EmptyState from "@/components/common/EmptyState";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { OUTCOME_LABELS } from "@/lib/followup";
import { formatDate } from "@/lib/format";
import type { FollowUpContext, FollowUpPlan, FollowUpTouch } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import { channelLabel, StartPlanModal, StopPlanModal } from "./FollowUpModals";
import { CONTEXT_CHIP } from "./FollowUpQueue";

function dotClass(t: FollowUpTouch, today: string) {
  if (t.status === "fait") return t.outcome === "a_revoir" ? "bg-error-500 border-error-500" : t.outcome === "besoin" ? "bg-warning-500 border-warning-500" : "bg-brand-500 border-brand-500";
  if (t.status === "ignore") return "bg-transparent border-gray-300 border-dashed dark:border-gray-600";
  return t.dueDate < today ? "bg-white border-error-500 dark:bg-gray-900" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-600";
}

/** Frise J0 → J120 → périodique d'un parcours. */
export function PlanTimeline({ plan }: { plan: FollowUpPlan }) {
  const { today } = useDemo();
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label="Étapes du suivi">
      {plan.touches.map((t, i) => {
        const title = `${t.stage} · ${t.label} · ${formatDate(t.dueDate)}${t.status === "fait" ? ` · ${t.outcome ? OUTCOME_LABELS[t.outcome] : "fait"}${t.channel ? ` (${channelLabel(t.channel)})` : ""}${t.note ? ` — ${t.note}` : ""}` : t.status === "ignore" ? ` · sautée${t.note ? ` — ${t.note}` : ""}` : ""}`;
        return (
          <li key={t.id} className="flex min-w-14 flex-1 flex-col items-center" title={title}>
            <div className="flex w-full items-center">
              <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : "bg-gray-200 dark:bg-gray-700")} />
              <span className={cn("size-3 shrink-0 rounded-full border-2", dotClass(t, today))} />
              <span className={cn("h-px flex-1", i === plan.touches.length - 1 ? "bg-transparent" : "bg-gray-200 dark:bg-gray-700")} />
            </div>
            <span className="mt-1 font-mono text-[10px] font-semibold text-gray-600 dark:text-gray-400">{t.stage === "periodique" ? "4-6 m" : t.stage}</span>
            <span className="text-[10px] text-gray-400 tabular-nums">{formatDate(t.dueDate).slice(0, 5)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function FollowUpPlans() {
  const { db, can } = useDemo();
  const [ctx, setCtx] = useState<"all" | FollowUpContext>("all");
  const [status, setStatus] = useState<"actif" | "clos">("actif");
  const [q, setQ] = useState("");
  const [start, setStart] = useState(false);
  const [stop, setStop] = useState<FollowUpPlan | null>(null);
  const editable = can("relation", "update");

  const plans = (db.followUps ?? []).filter((p) => (status === "actif" ? p.status === "actif" : p.status !== "actif") && (ctx === "all" || p.context === ctx));
  const needle = q.trim().toLowerCase();
  const list = plans.filter((p) => !needle || p.label.toLowerCase().includes(needle) || (db.clients.find((c) => c.id === p.clientId)?.name.toLowerCase().includes(needle) ?? false));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, animal, exploitation…" aria-label="Rechercher un suivi" className="h-9 w-56 rounded-lg border border-gray-200 bg-transparent px-3 text-sm dark:border-gray-800 dark:text-white/90" />
          <div role="group" aria-label="Type" className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
            {(["all", "compagnie", "rente"] as const).map((k) => (
              <button key={k} onClick={() => setCtx(k)} aria-pressed={ctx === k} className={cn("rounded-md px-2.5 py-1 text-theme-xs font-medium", ctx === k ? "bg-gray-800 text-white dark:bg-white/15" : "text-gray-600 dark:text-gray-400")}>
                {k === "all" ? "Tous" : CONTEXT_CHIP[k].label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Statut" className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
            {(["actif", "clos"] as const).map((k) => (
              <button key={k} onClick={() => setStatus(k)} aria-pressed={status === k} className={cn("rounded-md px-2.5 py-1 text-theme-xs font-medium", status === k ? "bg-gray-800 text-white dark:bg-white/15" : "text-gray-600 dark:text-gray-400")}>
                {k === "actif" ? "En cours" : "Terminés / arrêtés"}
              </button>
            ))}
          </div>
        </div>
        {editable && (
          <Button size="sm" startIcon={<PlusIcon />} onClick={() => setStart(true)}>
            Démarrer un suivi
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-brand-500 bg-brand-500" />Fait, tout va bien</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-warning-500 bg-warning-500" />Besoin exprimé</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-error-500 bg-error-500" />À revoir</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-error-500" />En retard</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-gray-300" />À venir</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-dashed border-gray-300" />Sautée</span>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Aucun suivi" description="Démarrez un suivi manuellement ou validez une consultation pour en créer un automatiquement." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {list.slice(0, 40).map((p) => {
            const client = db.clients.find((c) => c.id === p.clientId);
            const done = p.touches.filter((t) => t.status === "fait").length;
            return (
              <li key={p.id} className="min-w-0 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/clients/${p.clientId}`} className="text-sm font-semibold text-gray-800 hover:underline dark:text-white/90">{client?.name}</Link>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", CONTEXT_CHIP[p.context].cls)}>{CONTEXT_CHIP[p.context].label}</span>
                    </div>
                    <p className="truncate text-theme-xs text-gray-600 dark:text-gray-400">{p.label}</p>
                    <p className="text-[11px] text-gray-400">
                      Depuis le {formatDate(p.startDate)} · {done} contact(s) · suivi par {db.users.find((u) => u.id === p.ownerId)?.name ?? "—"}
                      {p.stopReason ? ` · ${p.stopReason}` : ""}
                    </p>
                  </div>
                  {editable && p.status === "actif" && (
                    <Button size="xs" variant="ghost" onClick={() => setStop(p)}>Arrêter</Button>
                  )}
                </div>
                <div className="mt-3">
                  <PlanTimeline plan={p} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <StartPlanModal isOpen={start} onClose={() => setStart(false)} />
      <StopPlanModal plan={stop} onClose={() => setStop(null)} />
    </div>
  );
}
