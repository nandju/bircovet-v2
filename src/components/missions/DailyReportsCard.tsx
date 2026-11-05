"use client";

import ActivityIcon from "@/components/common/ActivityIcon";
import { ApprovalItem } from "@/components/approvals/ApprovalsPage";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { missionKind } from "@/lib/activityKinds";
import { userName } from "@/lib/calc";
import { addDays, formatTime } from "@/lib/format";
import { RURAL_LABEL, ruralTypeOf } from "@/lib/rural";
import { cn } from "@/utils";
import { useState } from "react";

/** Rapports des collaborateurs du jour ou de la veille, et visites sans rapport. */
export function DailyReportsCard() {
  const { db, today } = useDemo();
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const d = day === "today" ? today : addDays(today, -1);
  const written = db.missions.filter((m) => m.reportUpdatedAt?.slice(0, 10) === d && m.report.trim());
  const expected = db.missions.filter((m) => m.status !== "annulee" && m.status !== "brouillon" && m.date.slice(0, 10) === d && !m.report.trim());
  const excerpt = (m: (typeof written)[number]) => {
    const s = m.reportSections ?? {};
    return s.diagnostic || s.constat || s.examen || s.resultats || s.motif || m.report;
  };
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Rapports des collaborateurs</h3>
        <div role="tablist" className="flex rounded-lg bg-gray-100 p-0.5 text-theme-xs dark:bg-white/5">
          {(["today", "yesterday"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)} className={cn("rounded-md px-2.5 py-1 font-medium", day === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
              {k === "today" ? "Aujourd'hui" : "Hier"}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {written.map((m) => {
          const pending = (db.approvals ?? []).filter((a) => a.refId === m.id && a.status === "en_attente").length;
          return (
            <li key={m.id} className="cliva-rise">
              <Link href={`/missions/${m.id}`} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/3">
                <p className="flex items-center gap-1.5 text-theme-xs text-gray-500">
                  <ActivityIcon kind={missionKind(m)} />
                  {RURAL_LABEL[ruralTypeOf(m)]} {m.code} · <strong className="text-gray-700 dark:text-gray-300">{userName(db, m.reportById ?? m.leaderId)}</strong> · {formatTime(m.reportUpdatedAt!)}
                  {(m.photos?.length ?? 0) > 0 && <span>· {m.photos!.length} photo(s)</span>}
                  {pending > 0 && <span className="ms-auto rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">aval demandé</span>}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-gray-800 dark:text-white/90">{db.farms.find((f) => f.id === m.farmIds[0])?.name ?? m.location} — {m.objective}</p>
                <p className="line-clamp-2 text-theme-xs text-gray-600 dark:text-gray-400">{excerpt(m)}</p>
              </Link>
            </li>
          );
        })}
        {expected.map((m) => (
          <li key={m.id}>
            <Link href={`/missions/${m.id}`} className="flex items-center gap-2 rounded-xl border border-dashed border-warning-300 px-3 py-2 text-theme-xs text-warning-700 hover:bg-warning-25 dark:border-warning-500/40 dark:text-warning-300">
              <ActivityIcon kind={missionKind(m)} className="!text-current" />
              Rapport attendu : {m.code} · {userName(db, m.leaderId)} · {m.location}
            </Link>
          </li>
        ))}
        {!written.length && !expected.length && <li className="py-6 text-center text-sm text-gray-500">Aucun rapport {day === "today" ? "aujourd'hui" : "hier"}.</li>}
      </ul>
    </section>
  );
}

/** Décisions soumises au directeur (DG) ou mes demandes en cours (collaborateur). */
export function PendingApprovalsCard() {
  const { db, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const list = (db.approvals ?? []).filter((a) => ["en_attente", "info_demandee"].includes(a.status) && (isDG || a.requestedById === user?.id)).sort((a, b) => (a.urgency === b.urgency ? b.requestedAt.localeCompare(a.requestedAt) : a.urgency === "urgente" ? -1 : 1));
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{isDG ? "Décisions en attente de votre aval" : "Mes demandes d'aval"}</h3>
        <Link href="/aval" className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Tout voir</Link>
      </div>
      <ul className="space-y-2">{list.slice(0, 4).map((a) => <ApprovalItem key={a.id} a={a} compact />)}</ul>
      {list.length === 0 && <p className="py-6 text-center text-sm text-gray-500">Rien en attente.</p>}
    </section>
  );
}
