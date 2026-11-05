"use client";

import EmptyState from "@/components/common/EmptyState";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { fillTemplate, planVars, templateFor } from "@/lib/followup";
import { addDays, daysBetween, formatDate } from "@/lib/format";
import type { FollowUpContext, FollowUpPlan, FollowUpTouch } from "@/lib/types";
import { cn } from "@/utils";
import { useMemo, useState } from "react";
import { channelLabel, fmtDue, PostponeTouchModal, TouchContactModal, type TouchTarget } from "./FollowUpModals";

type Row = { plan: FollowUpPlan; touch: FollowUpTouch };

export const CONTEXT_CHIP: Record<FollowUpContext, { label: string; cls: string }> = {
  compagnie: { label: "Compagnie", cls: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  rente: { label: "Rente", cls: "bg-secondary-50 text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-300" },
};

export function StageChip({ stage }: { stage: string }) {
  return <span className="inline-flex min-w-9 justify-center rounded-md bg-gray-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white dark:bg-white/15">{stage === "periodique" ? "4-6 m" : stage}</span>;
}

/** Relances dues (en retard, aujourd'hui, 7 prochains jours) pour les parcours actifs. */
export function useDueTouches(horizonDays = 7) {
  const { db, today } = useDemo();
  return useMemo(() => {
    const limit = addDays(today, horizonDays);
    const rows: Row[] = [];
    for (const plan of db.followUps ?? []) {
      if (plan.status !== "actif") continue;
      const touch = plan.touches.find((t) => t.status === "a_faire");
      if (touch && touch.dueDate <= limit) rows.push({ plan, touch });
    }
    return rows.sort((a, b) => a.touch.dueDate.localeCompare(b.touch.dueDate) || a.touch.day - b.touch.day);
  }, [db.followUps, today, horizonDays]);
}

export default function FollowUpQueue() {
  const { db, today, user, can } = useDemo();
  const rows = useDueTouches(7);
  const [ctx, setCtx] = useState<"all" | FollowUpContext>("all");
  const [mine, setMine] = useState(false);
  const [contact, setContact] = useState<TouchTarget | null>(null);
  const [resched, setResched] = useState<{ plan: FollowUpPlan; touch: FollowUpTouch; mode: "report" | "skip" } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const editable = can("relation", "update");

  const filtered = rows.filter((r) => (ctx === "all" || r.plan.context === ctx) && (!mine || r.plan.ownerId === user?.id));
  const groups = [
    { key: "late", title: "En retard", rows: filtered.filter((r) => r.touch.dueDate < today) },
    { key: "today", title: "Aujourd'hui", rows: filtered.filter((r) => r.touch.dueDate === today) },
    { key: "week", title: "7 prochains jours", rows: filtered.filter((r) => r.touch.dueDate > today) },
  ];

  const lastContact = (clientId: string) => db.interactions.find((i) => i.clientId === clientId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {groups.map((g) => (
            <span key={g.key} className={cn("rounded-lg px-3 py-1.5 font-medium", g.key === "late" && g.rows.length ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : g.key === "today" && g.rows.length ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400")}>
              <span className="tabular-nums">{g.rows.length}</span> {g.title.toLowerCase()}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Type de clientèle" className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
            {(["all", "compagnie", "rente"] as const).map((k) => (
              <button key={k} onClick={() => setCtx(k)} aria-pressed={ctx === k} className={cn("rounded-md px-2.5 py-1 text-theme-xs font-medium", ctx === k ? "bg-gray-800 text-white dark:bg-white/15" : "text-gray-600 dark:text-gray-400")}>
                {k === "all" ? "Tous" : CONTEXT_CHIP[k].label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-4 rounded border-gray-300 text-brand-500" />
            Mes suivis
          </label>
        </div>
      </div>

      {filtered.length === 0 && <EmptyState title="Aucune relance à faire" description="Les relances apparaissent ici dès qu'une consultation est validée, qu'un animal sort d'hospitalisation ou qu'une mission terrain est terminée." />}

      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <section key={g.key} aria-label={g.title} className="min-w-0 rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
              <h3 className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-800 sm:px-5 dark:text-white/90">
                <span className={cn("size-2 rounded-full", g.key === "late" ? "bg-error-500" : g.key === "today" ? "bg-warning-500" : "bg-gray-300 dark:bg-gray-600")} />
                {g.title}
                <span className="font-normal text-gray-400">· {g.rows.length}</span>
              </h3>
              <ul>
                {g.rows.map(({ plan, touch }) => {
                  const client = db.clients.find((c) => c.id === plan.clientId);
                  const last = lastContact(plan.clientId);
                  const tpl = templateFor(db, plan.context, touch.stage);
                  const preview = tpl ? fillTemplate(tpl.body, planVars(db, plan, user?.name)) : "";
                  const expanded = open === touch.id;
                  return (
                    <li key={touch.id} className="border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-800">
                      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                        <div className="flex w-24 shrink-0 flex-col gap-1">
                          <StageChip stage={touch.stage} />
                          <span className={cn("text-theme-xs", touch.dueDate < today ? "font-medium text-error-600 dark:text-error-400" : "text-gray-500 dark:text-gray-400")}>{fmtDue(touch.dueDate, today)}</span>
                        </div>
                        <div className="min-w-0 flex-1 basis-60">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/clients/${plan.clientId}`} className="text-sm font-semibold text-gray-800 hover:underline dark:text-white/90">
                              {client?.name ?? "Client"}
                            </Link>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", CONTEXT_CHIP[plan.context].cls)}>{CONTEXT_CHIP[plan.context].label}</span>
                            {touch.attempts > 0 && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/5 dark:text-gray-400">{touch.attempts} essai(s) sans réponse</span>}
                          </div>
                          <p className="truncate text-theme-xs text-gray-600 dark:text-gray-400">
                            {touch.label} · {plan.label}
                          </p>
                          <p className="text-theme-xs text-gray-400 dark:text-gray-500">
                            {last ? `Dernier contact il y a ${daysBetween(last.date.slice(0, 10), today)} j · ${channelLabel(last.channel)} · ${db.users.find((u) => u.id === last.userId)?.name ?? ""}` : "Aucun contact enregistré"}
                          </p>
                          {expanded && preview && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-theme-xs whitespace-pre-line text-gray-700 dark:bg-white/5 dark:text-gray-300">{preview}</p>}
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                          {editable ? (
                            <>
                              <Button size="xs" onClick={() => setContact({ plan, touch, channel: "whatsapp" })}>WhatsApp</Button>
                              <Button size="xs" variant="soft" onClick={() => setContact({ plan, touch, channel: "appel" })}>Appeler</Button>
                              <Button size="xs" variant="ghost" onClick={() => setOpen(expanded ? null : touch.id)} aria-expanded={expanded}>{expanded ? "Masquer" : "Message"}</Button>
                              <Button size="xs" variant="ghost" onClick={() => setResched({ plan, touch, mode: "report" })}>Reporter</Button>
                              <Button size="xs" variant="ghost" onClick={() => setResched({ plan, touch, mode: "skip" })}>Sauter</Button>
                            </>
                          ) : (
                            <span className="text-theme-xs text-gray-400">Lecture seule</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
      <p className="text-theme-xs text-gray-400 dark:text-gray-500">Chaque contact est enregistré dans l&apos;historique du client (date, canal, résultat, auteur). Relance suivante programmée automatiquement ; prochaines au-delà de 7 jours : onglet Parcours. Dernière mise à jour : {formatDate(today)}.</p>

      <TouchContactModal target={contact} onClose={() => setContact(null)} />
      <PostponeTouchModal target={resched} onClose={() => setResched(null)} />
    </div>
  );
}
