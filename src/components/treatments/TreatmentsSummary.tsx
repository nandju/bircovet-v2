"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { patientName, userName } from "@/lib/calc";
import { activeCourses, courseStats, daysWithoutNews, rateTone } from "@/lib/treatments";
import { cn } from "@/utils";

function Box({ title, children, tone }: { title: string; children: React.ReactNode; tone: string }) {
  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <p className="text-theme-xs font-medium tracking-wide text-gray-500 uppercase">{title}</p>
      {children}
    </div>
  );
}

/** Synthèse de l'observance : clinique (équipe) et domicile (propriétaires). */
export default function TreatmentsSummary({ now, compact = false }: { now: string; compact?: boolean }) {
  const { db, today } = useDemo();
  const act = activeCourses(db, today);
  const clinic = act.filter((c) => c.setting === "hospitalisation");
  const home = act.filter((c) => c.setting === "domicile");
  const st = (list: typeof act) => list.map((c) => ({ c, s: courseStats(c, now) }));
  const cs = st(clinic);
  const hs = st(home);
  const sum = (xs: ReturnType<typeof st>, k: "todayDue" | "todayGiven" | "overdue" | "given" | "due") => xs.reduce((n, x) => n + x.s[k], 0);
  const rate = (xs: ReturnType<typeof st>) => (sum(xs, "due") ? Math.round((sum(xs, "given") / sum(xs, "due")) * 100) : null);
  const silent = home.filter((c) => daysWithoutNews(c, today) >= 2);
  const worse = act.filter((c) => courseStats(c, now).trend?.trend === "aggravation");
  // Qui a fait les prises en clinique aujourd'hui.
  const byUser = new Map<string, number>();
  for (const c of clinic) for (const d of c.doses) if (d.day === today && d.status === "donne") byUser.set(d.userId, (byUser.get(d.userId) ?? 0) + 1);

  return (
    <div className={cn("grid grid-cols-1 gap-3", compact ? "" : "md:grid-cols-2")}>
      <Box title="En clinique — prises par l'équipe" tone="border-success-200 bg-success-25 dark:border-success-500/20 dark:bg-success-500/5">
        <div className="mt-1 flex items-end gap-4">
          <p className="text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{sum(cs, "todayGiven")}<span className="text-base text-gray-500">/{sum(cs, "todayDue")}</span></p>
          <p className="pb-1 text-theme-xs text-gray-600 dark:text-gray-400">prises faites aujourd&apos;hui (échues) · {clinic.length} traitement(s)</p>
          <p className={cn("ms-auto text-xl font-semibold whitespace-nowrap tabular-nums", rateTone(rate(cs)))}>{rate(cs) ?? "—"}{rate(cs) !== null && " %"}</p>
        </div>
        {sum(cs, "overdue") > 0 && <p className="mt-1 text-theme-xs font-medium text-warning-700 dark:text-warning-400">{sum(cs, "overdue")} prise(s) échue(s) non cochée(s)</p>}
        {byUser.size > 0 && <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-400">Aujourd&apos;hui : {[...byUser].map(([u, n]) => `${userName(db, u)} (${n})`).join(", ")}</p>}
      </Box>
      <Box title="À domicile — confirmations des propriétaires" tone="border-tertiary-200 bg-tertiary-25 dark:border-tertiary-500/20 dark:bg-tertiary-500/5">
        <div className="mt-1 flex items-end gap-4">
          <p className="text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{home.length}</p>
          <p className="pb-1 text-theme-xs text-gray-600 dark:text-gray-400">traitement(s) en cours · observance déclarée</p>
          <p className={cn("ms-auto text-xl font-semibold whitespace-nowrap tabular-nums", rateTone(rate(hs)))}>{rate(hs) ?? "—"}{rate(hs) !== null && " %"}</p>
        </div>
        {silent.length > 0 && (
          <p className="mt-1 text-theme-xs font-medium text-warning-700 dark:text-warning-400">
            Sans nouvelles depuis 2 jours ou plus : {silent.map((c) => patientName(db, c.patientId)).join(", ")}
          </p>
        )}
      </Box>
      {worse.length > 0 && (
        <p className={cn("rounded-xl bg-error-50 px-3 py-2 text-theme-xs text-error-700 dark:bg-error-500/10 dark:text-error-300", compact ? "" : "md:col-span-2")}>
          Évolution défavorable signalée : {worse.map((c) => `${patientName(db, c.patientId)} (${c.label})`).join(", ")}. <Link href="/traitements" className="font-semibold underline">Voir</Link>
        </p>
      )}
    </div>
  );
}
