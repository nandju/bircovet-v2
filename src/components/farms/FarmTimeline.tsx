"use client";

import ActivityIcon from "@/components/common/ActivityIcon";
import ComponentCard from "@/components/common/ComponentCard";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import type { ActivityKind } from "@/lib/activityKinds";
import { missionKind } from "@/lib/activityKinds";
import { userName } from "@/lib/calc";
import { INTERVENTION_KINDS } from "@/lib/farmProfile";
import { formatDate } from "@/lib/format";
import type { Farm } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

interface Ev {
  id: string;
  date: string;
  kind: ActivityKind;
  group: "visite" | "action" | "intervention" | "mouvement";
  title: string;
  detail?: string;
  href?: string;
  done?: boolean;
}

const GROUPS = [
  { k: "all", label: "Tout" },
  { k: "visite", label: "Visites et missions" },
  { k: "intervention", label: "Interventions" },
  { k: "action", label: "Actions à mener" },
] as const;

/** Historique unique de l'exploitation : visites, missions, interventions, actions, mouvements. */
export default function FarmTimeline({ farm: f }: { farm: Farm }) {
  const { db } = useDemo();
  const [g, setG] = useState<(typeof GROUPS)[number]["k"]>("all");
  const missions = db.missions.filter((m) => m.farmIds.includes(f.id));
  const evs: Ev[] = [
    ...f.visits.map((v) => ({ id: v.id, date: v.date, kind: "visite" as const, group: "visite" as const, title: v.purpose, detail: `${userName(db, v.vetId)} — ${v.report}` })),
    ...missions.map((m) => ({ id: m.id, date: m.date, kind: missionKind(m), group: "visite" as const, title: `${m.code} — ${m.objective}`, detail: `${userName(db, m.leaderId)} · ${m.interventionsDone.join(", ") || m.plannedInterventions.join(", ") || "—"}`, href: `/missions/${m.id}` })),
    ...missions.flatMap((m) => m.actionItems.map((a) => ({ id: a.id, date: a.dueDate ?? m.date, kind: "suivi" as const, group: "action" as const, title: a.label, detail: `${a.assigneeId ? userName(db, a.assigneeId) : "Non attribuée"} · issue de ${m.code}`, href: `/missions/${m.id}`, done: a.done }))),
    ...(f.interventions ?? []).map((x) => ({ id: x.id, date: x.date, kind: (x.kind === "vaccination" ? "vaccination" : x.kind === "conseil" ? "alimentation" : "maladie") as ActivityKind, group: "intervention" as const, title: `${INTERVENTION_KINDS.find((k) => k.value === x.kind)?.label} · ${x.species} (${x.count.toLocaleString("fr-FR")})`, detail: [x.product, x.problem, x.note].filter(Boolean).join(" · ") })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const list = evs.filter((e) => g === "all" || e.group === g);
  return (
    <ComponentCard title="Historique de l'exploitation">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {GROUPS.map((x) => (
          <button key={x.k} type="button" aria-pressed={g === x.k} onClick={() => setG(x.k)} className={cn("cliva-press rounded-full border px-3 py-1 text-theme-xs", g === x.k ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")}>
            {x.label} <span className="opacity-70">{x.k === "all" ? evs.length : evs.filter((e) => e.group === x.k).length}</span>
          </button>
        ))}
      </div>
      <ol className="relative space-y-3 border-s border-gray-200 ps-5 dark:border-gray-800">
        {list.map((e) => (
          <li key={`${e.group}-${e.id}`} className="cliva-rise relative">
            <span className="absolute -start-[1.95rem] top-0.5 flex size-6 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <ActivityIcon kind={e.kind} />
            </span>
            <p className="text-theme-xs text-gray-500">{formatDate(e.date)}{e.group === "action" && (e.done ? " · faite" : " · à faire")}</p>
            <p className={cn("text-sm font-medium text-gray-800 dark:text-white/90", e.done && "text-gray-500 line-through")}>
              {e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}
            </p>
            {e.detail && <p className="line-clamp-2 text-theme-xs text-gray-600 dark:text-gray-400">{e.detail}</p>}
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-gray-500">Rien à afficher.</li>}
      </ol>
    </ComponentCard>
  );
}
