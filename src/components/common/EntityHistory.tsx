"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";

export interface HistoryItem {
  date: string;
  label: string;
  detail?: string;
  userId?: string;
}

/** Frise chronologique d'historique (journal + événements métier). */
export default function EntityHistory({ items, auditTargets = [] }: { items?: HistoryItem[]; auditTargets?: string[] }) {
  const { db } = useDemo();
  const fromAudit: HistoryItem[] = db.audit
    .filter((a) => auditTargets.some((t) => t && a.target.includes(t)))
    .map((a) => ({ date: a.date, label: `${a.module} — ${a.action}`, detail: [a.oldValue && `Avant : ${a.oldValue}`, a.newValue && `Après : ${a.newValue}`, a.reason && `Motif : ${a.reason}`, a.decision && `Décision : ${a.decision}`].filter(Boolean).join(" · "), userId: a.userId }));
  const all = [...(items ?? []), ...fromAudit].sort((a, b) => b.date.localeCompare(a.date));
  if (!all.length) return <p className="text-sm text-gray-500">Aucun historique.</p>;
  return (
    <ol className="relative space-y-4 border-s border-gray-200 ps-5 dark:border-gray-800">
      {all.slice(0, 60).map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -start-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500 dark:border-gray-900" />
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{h.label}</p>
          {h.detail && <p className="text-theme-xs text-gray-600 dark:text-gray-400">{h.detail}</p>}
          <p className="text-[11px] text-gray-400">
            {formatDateTime(h.date)}
            {h.userId && ` · ${userName(db, h.userId)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
