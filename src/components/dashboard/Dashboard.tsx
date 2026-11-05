"use client";

import { useQueryParam } from "@/hooks/useQueryFlag";
import { useNow } from "@/hooks/useNow";
import AnnouncementCarousel from "@/components/common/AnnouncementCarousel";
import { universe } from "@/lib/universe";
import { Link } from "@/i18n/navigation";
import { CartIcon } from "@/icons";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDateLong, formatXOF } from "@/lib/format";
import { receiptsOn } from "@/lib/daily";
import { payablesSummary } from "@/lib/payables";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/utils";
import { useEffect, useState } from "react";
import { ClinicView, GestionView, RuralView } from "./DashboardViews";
import SharedRecords from "./SharedRecords";
import { useDashboardData } from "./useDashboardData";

type View = "clinique" | "rural" | "gestion";
const UNI: Record<View, string> = { clinique: "clinique", rural: "rural", gestion: "gestion" };
const VIEW_KEY = "cliva.dashboard.view";
const HERO: Record<View, string> = { clinique: "cliva-grad-brand", rural: "cliva-grad-rural", gestion: "cliva-grad-gestion" };
const TAGLINE: Record<View, string> = {
  clinique: "Consultations, hospitalisations et traitements des animaux de compagnie.",
  rural: "Visites de ferme, urgences, rapports de vos collaborateurs et décisions à valider.",
  gestion: "Caisse, factures, stock et personnel en un coup d'œil.",
};

const VIEWS: { key: View; label: string; desc: string }[] = [
  { key: "clinique", label: "Clinique", desc: "Animaux de compagnie" },
  { key: "rural", label: "Rural", desc: "Animaux de rente" },
  { key: "gestion", label: "Gestion", desc: "Caisse, factures, stock" },
];

export default function Dashboard() {
  const { db, user, establishment, can, today } = useDemo();
  const nowHM = useNow().slice(11, 16);
  const [scope, setScope] = useState<"est" | "all">("all");
  const data = useDashboardData(scope === "est" ? establishment?.id : undefined);
  const allowed = VIEWS.filter((v) => (v.key === "clinique" ? can("consultations") || can("agenda") : v.key === "rural" ? can("missions") || can("exploitations") : can("facturation") || can("finances") || can("stock")));
  const fallback: View = user?.roleId === "comptable" ? "gestion" : "clinique";
  const [view, setView] = useState<View>(fallback);
  const vueParam = useQueryParam("vue") as View | null;

  useEffect(() => {
    if (!user) return;
    let saved: View | null = null;
    try {
      saved = localStorage.getItem(`${VIEW_KEY}.${user.id}`) as View | null;
    } catch {
      /* stockage indisponible */
    }
    if (vueParam && allowed.some((v) => v.key === vueParam)) saved = vueParam;
    setView(saved && allowed.some((v) => v.key === saved) ? saved : allowed.some((v) => v.key === fallback) ? fallback : (allowed[0]?.key ?? "clinique"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, vueParam]);

  if (!user) return null;
  if (user.roleId === "confrere") return <SharedRecords />;

  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(`${VIEW_KEY}.${user.id}`, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const est = scope === "est" ? establishment?.id : undefined;
  const hour = Number(nowHM.slice(0, 2));
  const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const pendingAval = (db.approvals ?? []).filter((a) => a.status === "en_attente" && (user.roleId === "dg" || a.requestedById === user.id)).length;
  const reportsToday = db.missions.filter((m) => m.reportUpdatedAt?.slice(0, 10) === today).length;
  const pills: { value: number | string; label: string; href: string }[] =
    view === "clinique"
      ? [{ value: data.todayAppointments, label: "RDV aujourd'hui", href: "/agenda" }, { value: data.waiting, label: "en salle d'attente", href: "/agenda/file-attente" }, { value: data.hospitalized, label: "hospitalisé(s)", href: "/hospitalisation" }]
      : view === "rural"
        ? [{ value: data.missionsPlanned, label: "sorties programmées", href: "/missions" }, { value: reportsToday, label: "rapport(s) du jour", href: "/missions/rapports" }, { value: pendingAval, label: "aval(s) en attente", href: "/aval" }]
        : [{ value: formatXOF(receiptsOn(db, today, est).total), label: "recette du jour", href: "/finances/encaissements" }, { value: formatXOF(payablesSummary(db, today, est).overdue), label: "dû aux fournisseurs (échu)", href: "/achats/dettes" }, { value: data.alerts.low.length, label: "article(s) sous le seuil", href: "/stock/alertes" }, { value: pendingAval, label: "aval(s) en attente", href: "/aval" }];

  return (
    <div className="space-y-4 md:space-y-6">
      <section className={cn("cliva-glow cliva-rise rounded-3xl p-5 text-white shadow-cliva sm:p-7", HERO[view])}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-white/75">{formatDateLong(today)} · {roleLabel(user.roleId)}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{greet}, {user.name.split(" ").slice(0, 2).join(" ")}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">{TAGLINE[view]}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {pills.map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="cliva-press flex items-baseline gap-2 rounded-2xl bg-white/15 px-3.5 py-2 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/25">
                    <span className="text-xl font-semibold tabular-nums">{x.value}</span>
                    <span className="text-theme-xs text-white/80">{x.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can("stock", "update") && (
              <Link href="/stock/vente" className="cliva-press inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-gray-900 shadow-theme-sm hover:bg-white/90">
                <CartIcon className="size-4.5" />
                Vente pharmacie
              </Link>
            )}
            <div role="group" aria-label="Périmètre" className="flex rounded-full bg-black/15 p-1 ring-1 ring-white/20">
              {([["all", "Tous les sites"], ["est", establishment?.city ?? "Mon site"]] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={cn("rounded-full px-3.5 py-1.5 text-theme-xs font-medium transition", scope === k ? "bg-white text-gray-900 shadow-theme-xs" : "text-white/85 hover:text-white")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {allowed.length > 1 && (
        <div role="tablist" aria-label="Activité" className="flex w-full gap-1 overflow-x-auto rounded-full border border-gray-200/70 bg-white p-1 shadow-cliva no-scrollbar sm:inline-flex sm:w-auto dark:border-gray-800 dark:bg-gray-900">
          {allowed.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => choose(v.key)}
              className={cn("cliva-press flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-300 sm:flex-none sm:px-5", view === v.key ? cn(HERO[v.key], "text-white shadow-theme-sm") : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5")}
            >
              <span aria-hidden className={cn("size-2 rounded-full", view === v.key ? "bg-white" : universe(UNI[v.key]).dot)} />
              {v.label}
              <span className={cn("hidden text-[11px] font-normal md:inline", view === v.key ? "text-white/80" : "text-gray-400")}>{v.desc}</span>
            </button>
          ))}
        </div>
      )}
      <AnnouncementCarousel placement="dashboard" />
      <div key={view} className="cliva-rise space-y-4 md:space-y-6">
        {view === "clinique" && <ClinicView data={data} />}
        {view === "rural" && <RuralView data={data} />}
        {view === "gestion" && <GestionView data={data} est={est} />}
      </div>
      <p className="text-center text-theme-xs text-gray-400 dark:text-gray-500">Indicateurs calculés à partir des données fictives enregistrées dans ce navigateur ; ils évoluent après chaque opération simulée.</p>
    </div>
  );
}
