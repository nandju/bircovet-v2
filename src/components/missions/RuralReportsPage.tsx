"use client";

import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CopyButton } from "@/components/crm/followup/FollowUpModals";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { userName } from "@/lib/calc";
import { addDays, formatDate } from "@/lib/format";
import { RURAL_LABEL, ruralTypeOf } from "@/lib/rural";
import { toggleMissionAction } from "@/lib/services/missionsService";
import type { Mission, MissionAction } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const TYPE_CHIP = {
  visite: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  urgence: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300",
  mission: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
};

function TypeChip({ m }: { m: Mission }) {
  const t = ruralTypeOf(m);
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", TYPE_CHIP[t])}>{RURAL_LABEL[t]}</span>;
}

/** Rural : rapports à rédiger, actions à mener chez les éleveurs, derniers rapports. */
export default function RuralReportsPage() {
  const { db, today, user, run, can } = useDemo();
  const [mine, setMine] = useState(false);
  const farmName = (m: Mission) => m.farmIds.map((f) => db.farms.find((x) => x.id === f)?.name).filter(Boolean).join(", ") || m.location;

  const toWrite = db.missions.filter((m) => (m.status === "en_cours" && m.endDate.slice(0, 10) <= today) || (m.status === "terminee" && !m.report.trim())).sort((a, b) => a.date.localeCompare(b.date));
  const actions = db.missions
    .flatMap((m) => m.actionItems.map((a) => ({ m, a })))
    .filter(({ a }) => !a.done && (!mine || a.assigneeId === user?.id));
  const week = addDays(today, 7);
  const groups: { key: string; title: string; dot: string; rows: { m: Mission; a: MissionAction }[] }[] = [
    { key: "late", title: "En retard", dot: "bg-error-500", rows: actions.filter(({ a }) => a.dueDate && a.dueDate < today) },
    { key: "week", title: "Cette semaine", dot: "bg-warning-500", rows: actions.filter(({ a }) => a.dueDate && a.dueDate >= today && a.dueDate <= week) },
    { key: "later", title: "Plus tard", dot: "bg-gray-300 dark:bg-gray-600", rows: actions.filter(({ a }) => a.dueDate && a.dueDate > week) },
    { key: "none", title: "Sans échéance", dot: "bg-gray-300 dark:bg-gray-600", rows: actions.filter(({ a }) => !a.dueDate) },
  ];
  const recent = db.missions.filter((m) => m.status === "terminee" && m.report.trim()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Rapports et actions à mener" subtitle="Rural · animaux de rente" trail={[{ label: "Visites, urgences et missions", href: "/missions" }]} />

      <section aria-labelledby="to-write" className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <h2 id="to-write" className="px-4 py-3 text-base font-semibold text-gray-800 sm:px-5 dark:text-white/90">
          Rapports à rédiger <span className="font-normal text-gray-400">· {toWrite.length}</span>
        </h2>
        {toWrite.length === 0 ? (
          <p className="border-t border-gray-100 px-4 py-4 text-sm text-gray-500 sm:px-5 dark:border-gray-800">Tous les rapports sont rédigés.</p>
        ) : (
          <ul>
            {toWrite.map((m) => (
              <li key={m.id} className="border-t border-gray-100 dark:border-gray-800">
                <Link href={`/missions/${m.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50 sm:px-5 dark:hover:bg-white/3">
                  <TypeChip m={m} />
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-white/90">
                    {m.code} — {m.objective}
                  </span>
                  <span className="text-theme-xs text-gray-500">
                    {farmName(m)} · {formatDate(m.date)} · {userName(db, m.leaderId)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="actions" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="actions" className="text-base font-semibold text-gray-800 dark:text-white/90">
            Actions à mener chez les éleveurs <span className="font-normal text-gray-400">· {actions.length}</span>
          </h2>
          <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-4 rounded border-gray-300 text-brand-500" />
            Mes actions
          </label>
        </div>
        {actions.length === 0 && <EmptyState title="Aucune action en attente" description="Ajoutez des actions à mener depuis une visite ou une urgence (onglet Vue générale)." />}
        {groups.map(
          (g) =>
            g.rows.length > 0 && (
              <div key={g.key} className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
                <h3 className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-800 sm:px-5 dark:text-white/90">
                  <span className={cn("size-2 rounded-full", g.dot)} />
                  {g.title} <span className="font-normal text-gray-400">· {g.rows.length}</span>
                </h3>
                <ul>
                  {g.rows.map(({ m, a }) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 sm:px-5 dark:border-gray-800">
                      <input type="checkbox" checked={a.done} disabled={!can("missions", "update")} onChange={() => run(toggleMissionAction, { id: m.id, actionId: a.id })} aria-label={`Marquer « ${a.label} » comme faite`} className="size-4 rounded border-gray-300 accent-brand-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-gray-800 dark:text-white/90">{a.label}</span>
                        <Link href={`/missions/${m.id}`} className="text-theme-xs text-gray-500 hover:underline">
                          {farmName(m)} · {m.code}
                        </Link>
                      </span>
                      <span className="text-theme-xs text-gray-500">{a.assigneeId ? userName(db, a.assigneeId) : "Non attribuée"}</span>
                      <span className={cn("w-20 text-end text-theme-xs tabular-nums", g.key === "late" ? "font-medium text-error-600 dark:text-error-400" : "text-gray-500")}>{a.dueDate ? formatDate(a.dueDate) : "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
      </section>

      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="text-base font-semibold text-gray-800 dark:text-white/90">Derniers rapports</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun rapport pour l&apos;instant.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recent.map((m) => (
              <li key={m.id} className="min-w-0 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeChip m={m} />
                  <Link href={`/missions/${m.id}`} className="text-sm font-semibold text-gray-800 hover:underline dark:text-white/90">
                    {m.code} — {farmName(m)}
                  </Link>
                  <span className="ms-auto text-theme-xs text-gray-500">{formatDate(m.date)}</span>
                </div>
                <p className="mt-2 line-clamp-4 text-theme-xs whitespace-pre-line text-gray-600 dark:text-gray-400">{m.report}</p>
                <div className="mt-2 flex justify-end">
                  <CopyButton text={`${RURAL_LABEL[ruralTypeOf(m)]} ${m.code} — ${farmName(m)} — ${formatDate(m.date)}\n\n${m.report}`} label="Copier" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
