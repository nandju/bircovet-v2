"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { absentOn, LEAVE_META, OBJ_STATE, objectiveProgress, objectiveState } from "@/lib/staff";
import { cn } from "@/utils";

/** Personnel en un coup d'œil : absents, demandes à valider, objectifs à surveiller. */
export default function StaffSummaryCard() {
  const { db, today, user } = useDemo();
  const absent = absentOn(db, today);
  const pending = (db.leaves ?? []).filter((l) => l.status === "en_attente");
  const watch = (db.objectives ?? []).filter((o) => o.status === "en_cours").map((o) => ({ o, st: objectiveState(o, today) })).sort((a, b) => a.o.dueDate.localeCompare(b.o.dueDate)).slice(0, 4);
  return (
    <section className="h-full rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Personnel</h3>
        <Link href="/personnel" className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Gérer</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          <p className="text-theme-xs text-gray-500">Absents aujourd&apos;hui</p>
          <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{absent.length}</p>
          <p className="truncate text-[11px] text-gray-500">{absent.map((a) => `${userName(db, a.userId)} (${LEAVE_META[a.kind].label.toLowerCase()})`).join(", ") || "Équipe au complet"}</p>
        </div>
        <div className={cn("rounded-xl p-3", pending.length ? "bg-warning-50 dark:bg-warning-500/10" : "bg-gray-50 dark:bg-white/5")}>
          <p className="text-theme-xs text-gray-500">Demandes à valider</p>
          <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{pending.length}</p>
          <p className="truncate text-[11px] text-gray-500">{user?.roleId === "dg" ? pending.map((l) => userName(db, l.userId)).join(", ") || "—" : "validation par le DG"}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {watch.map(({ o, st }) => (
          <li key={o.id}>
            <div className="flex items-center justify-between gap-2 text-theme-xs">
              <span className="truncate text-gray-700 dark:text-gray-300"><strong>{userName(db, o.userId)}</strong> · {o.title}</span>
              <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", OBJ_STATE[st].chip)}>{OBJ_STATE[st].label}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className={cn("h-full rounded-full", OBJ_STATE[st].bar)} style={{ width: `${objectiveProgress(o)}%` }} /></div>
              <span className="text-[10px] text-gray-500 tabular-nums">{objectiveProgress(o)} % · {formatDate(o.dueDate)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
