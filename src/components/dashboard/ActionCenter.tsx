"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { AlertTriangleIcon, BedIcon, ChatIcon, ChevronLeftIcon, DocsIcon, ReceiptIcon, StethoscopeIcon, TaskIcon, TruckIcon, UsersIcon } from "@/icons";
import { addDays, formatXOF } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import { cn } from "@/utils";
import type { useDashboardData } from "./useDashboardData";

type Data = ReturnType<typeof useDashboardData>;
type Level = "critique" | "attention" | "en_cours" | "ok";

interface Item {
  key: string;
  module: ModuleId;
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
  detail: string;
  level: Level;
}

const RANK: Record<Level, number> = { critique: 0, attention: 1, en_cours: 2, ok: 3 };

const LEVEL_STYLE: Record<Level, { dot: string; count: string; icon: string; tag: string; tagLabel: string }> = {
  critique: {
    dot: "bg-error-500",
    count: "text-error-600 dark:text-error-400",
    icon: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
    tag: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300",
    tagLabel: "À traiter",
  },
  attention: {
    dot: "bg-warning-500",
    count: "text-warning-600 dark:text-warning-400",
    icon: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
    tag: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300",
    tagLabel: "À surveiller",
  },
  en_cours: {
    dot: "bg-tertiary-500",
    count: "text-gray-800 dark:text-white/90",
    icon: "bg-tertiary-50 text-tertiary-600 dark:bg-tertiary-500/15 dark:text-tertiary-300",
    tag: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300",
    tagLabel: "En cours",
  },
  ok: {
    dot: "bg-gray-300 dark:bg-gray-600",
    count: "text-gray-400 dark:text-gray-500",
    icon: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
    tag: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
    tagLabel: "RAS",
  },
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export type DashScope = "clinique" | "rural" | "gestion";

/** Ce qui demande une action maintenant, trié par gravité, pour une partie de l'activité. */
export default function ActionCenter({ data, stacked = false, scope }: { data: Data; stacked?: boolean; scope: DashScope }) {
  const { can, db, today } = useDemo();
  const stockIssues = data.lowStock + data.expiring + data.alerts.expired.length;
  const ctx = scope === "rural" ? "rente" : "compagnie";
  const dueTouches = (db.followUps ?? []).filter((p) => p.status === "actif" && p.context === ctx && p.touches.some((x) => x.status === "a_faire" && x.dueDate <= today));
  const lateTouches = dueTouches.filter((p) => p.touches.some((x) => x.status === "a_faire" && x.dueDate < today)).length;
  const prospectsDue = (db.prospects ?? []).filter((p) => ["nouveau", "contacte", "besoin_identifie", "proposition"].includes(p.stage) && (p.activity === ctx || p.activity === "mixte") && p.nextActionDate && p.nextActionDate <= today).length;
  const followCount = dueTouches.length + prospectsDue;

  const live = db.missions.filter((m) => m.status !== "annulee" && m.status !== "terminee" && m.status !== "brouillon");
  const urgences = live.filter((m) => m.category === "urgence" || m.category === "hors_horaires");
  const todayMissions = live.filter((m) => m.category !== "urgence" && m.date.slice(0, 10) <= today && m.endDate.slice(0, 10) >= today);
  const reportsDue = live.filter((m) => m.status === "en_cours" && m.endDate.slice(0, 10) < today);
  const openActions = db.missions.flatMap((m) => m.actionItems.filter((a) => !a.done && a.dueDate).map((a) => ({ m, a })));
  const lateActions = openActions.filter(({ a }) => a.dueDate! < today).length;
  const weekActions = openActions.filter(({ a }) => a.dueDate! >= today && a.dueDate! <= addDays(today, 7)).length;

  const items: (Item & { scopes: DashScope[] })[] = [
    {
      key: "followup",
      scopes: ["clinique", "rural"],
      module: "relation",
      href: "/relation-client/suivi",
      icon: <ChatIcon />,
      count: followCount,
      label: scope === "rural" ? "Relances éleveurs" : "Relances clients",
      detail: followCount
        ? [dueTouches.length && `${dueTouches.length} suivi(s) à contacter${lateTouches ? ` dont ${lateTouches} en retard` : ""}`, prospectsDue && `${prospectsDue} prospect(s) à rappeler`].filter(Boolean).join(" · ")
        : "tous les clients ont été contactés",
      level: lateTouches ? "critique" : followCount ? "attention" : "ok",
    },
    {
      key: "waiting",
      scopes: ["clinique"],
      module: "agenda",
      href: "/agenda/file-attente",
      icon: <UsersIcon />,
      count: data.waiting,
      label: "En salle d'attente",
      detail: data.waiting ? `sur ${plural(data.todayAppointments, "rendez-vous", "rendez-vous")} aujourd'hui` : `${plural(data.todayAppointments, "rendez-vous", "rendez-vous")} aujourd'hui`,
      level: data.waiting >= 3 ? "attention" : data.waiting > 0 ? "en_cours" : "ok",
    },
    {
      key: "cons",
      scopes: ["clinique"],
      module: "consultations",
      href: "/consultations",
      icon: <StethoscopeIcon />,
      count: data.inConsultation,
      label: "Consultations ouvertes",
      detail: data.inConsultation ? "à finaliser et valider" : "aucune en attente de validation",
      level: data.inConsultation > 0 ? "en_cours" : "ok",
    },
    {
      key: "hosp",
      scopes: ["clinique"],
      module: "hospitalisation",
      href: "/hospitalisation",
      icon: <BedIcon />,
      count: data.hospitalized,
      label: "Patients hospitalisés",
      detail: data.hospitalized ? "soins et constantes du jour" : "aucun séjour en cours",
      level: data.hospitalized > 0 ? "attention" : "ok",
    },
    {
      key: "urg",
      scopes: ["rural"],
      module: "missions",
      href: "/missions?filtre=urgence",
      icon: <AlertTriangleIcon />,
      count: urgences.length,
      label: "Urgences rurales en cours",
      detail: urgences.length ? urgences.map((m) => m.location).slice(0, 2).join(" · ") : "aucune urgence ouverte",
      level: urgences.length ? "critique" : "ok",
    },
    {
      key: "mis",
      scopes: ["rural"],
      module: "missions",
      href: "/missions",
      icon: <TruckIcon />,
      count: todayMissions.length,
      label: "Visites et missions du jour",
      detail: todayMissions.length ? todayMissions.map((m) => m.location).slice(0, 2).join(" · ") : "aucune sortie prévue aujourd'hui",
      level: todayMissions.length ? "en_cours" : "ok",
    },
    {
      key: "rep",
      scopes: ["rural"],
      module: "missions",
      href: "/missions",
      icon: <DocsIcon />,
      count: reportsDue.length,
      label: "Rapports à rédiger",
      detail: reportsDue.length ? "missions passées non clôturées" : "tous les rapports sont faits",
      level: reportsDue.length ? "attention" : "ok",
    },
    {
      key: "act",
      scopes: ["rural"],
      module: "missions",
      href: "/missions",
      icon: <TaskIcon />,
      count: lateActions + weekActions,
      label: "Actions à mener en élevage",
      detail: lateActions + weekActions ? [lateActions && `${lateActions} en retard`, weekActions && `${weekActions} cette semaine`].filter(Boolean).join(" · ") : "aucune action en attente",
      level: lateActions ? "critique" : weekActions ? "attention" : "ok",
    },
    {
      key: "unpaid",
      scopes: ["gestion"],
      module: "facturation",
      href: "/facturation",
      icon: <ReceiptIcon />,
      count: data.unpaidCount,
      label: "Factures impayées",
      detail: data.unpaidCount ? `solde ${formatXOF(data.unpaidAmount)}` : "tout est réglé",
      level: data.unpaidCount > 0 ? "critique" : "ok",
    },
    {
      key: "stock",
      scopes: ["gestion"],
      module: "stock",
      href: "/stock/alertes",
      icon: <AlertTriangleIcon />,
      count: stockIssues,
      label: "Alertes pharmacie",
      detail: stockIssues
        ? [data.alerts.expired.length && plural(data.alerts.expired.length, "lot périmé", "lots périmés"), data.lowStock && `${data.lowStock} sous le seuil`, data.expiring && plural(data.expiring, "lot proche péremption", "lots proches péremption")].filter(Boolean).join(" · ")
        : "stock et lots conformes",
      level: data.alerts.expired.length || data.lowStock ? "critique" : data.expiring ? "attention" : "ok",
    },
    {
      key: "tasks",
      scopes: ["clinique", "gestion"],
      module: "relation",
      href: "/relation-client",
      icon: <TaskIcon />,
      count: data.overdueTasks,
      label: "Tâches en retard",
      detail: data.overdueTasks ? "échéance dépassée" : "aucune tâche en retard",
      level: data.overdueTasks > 0 ? "critique" : "ok",
    },
  ].filter((i) => i.scopes.includes(scope)) as (Item & { scopes: DashScope[] })[];

  const visible = items.filter((i) => can(i.module)).sort((a, b) => RANK[a.level] - RANK[b.level]);
  if (!visible.length) return null;
  const urgent = visible.filter((i) => i.level === "critique").length;

  return (
    <section aria-labelledby="action-center-title" className={cn(stacked && "h-full", "min-w-0 rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-3 sm:px-5">
        <h2 id="action-center-title" className="text-base font-semibold text-gray-800 dark:text-white/90">
          À traiter maintenant
        </h2>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">{urgent ? plural(urgent, "point urgent", "points urgents") : "Aucun point urgent"}</p>
      </div>
      <ul className={cn("grid grid-cols-1 sm:grid-cols-2", stacked && "xl:grid-cols-1")}>
        {visible.map((i) => {
          const s = LEVEL_STYLE[i.level];
          return (
            <li key={i.key} className={cn("min-w-0 border-t border-gray-100 sm:odd:border-e dark:border-gray-800", stacked && "xl:odd:border-e-0")}>
              <Link href={i.href} className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50 focus-visible:bg-gray-50 sm:px-5 dark:hover:bg-white/3 dark:focus-visible:bg-white/3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5", s.icon)}>{i.icon}</span>
                <span className={cn("w-9 shrink-0 text-end text-2xl leading-none font-semibold tabular-nums", s.count)}>{i.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">{i.label}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium", s.tag)}>
                      <span className={cn("size-1.5 rounded-full", s.dot)} />
                      {s.tagLabel}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">{i.detail}</span>
                </span>
                <ChevronLeftIcon className="size-4 shrink-0 rotate-180 text-gray-300 transition group-hover:text-gray-500 rtl:rotate-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
