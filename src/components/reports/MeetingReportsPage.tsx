"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PrinterIcon } from "@/icons";
import { ACTIVITY_META } from "@/lib/clientActivity";
import { addDays, formatDate, formatXOF } from "@/lib/format";
import { OUTCOME_LABELS } from "@/lib/followup";
import { actionsReport, clientsReport, clinicReport, financeReport, moleculeDemand, pharmacyReport, referrersReport, ruralReport, treatmentsReport, type RPeriod } from "@/lib/meetingReports";
import { RURAL_LABEL } from "@/lib/rural";
import { LEAVE_META, leaveDays, OBJ_STATE, objectiveState } from "@/lib/staff";
import type { ModuleId } from "@/lib/permissions";
import { cn } from "@/utils";
import { useMemo, useState, type ReactNode } from "react";

type Cat = "pharmacie" | "clients" | "clinique" | "rural" | "actions" | "finances" | "recommandants" | "personnel";
const CATS: { key: Cat; label: string; desc: string; module: ModuleId; tone: string }[] = [
  { key: "pharmacie", label: "Pharmacie", desc: "Ventes comptoir, éleveurs captés, ruptures", module: "stock", tone: "bg-tertiary-500" },
  { key: "clients", label: "Clients et suivi", desc: "Nouveaux clients, relances, besoins, prospects", module: "relation", tone: "bg-theme-purple-500" },
  { key: "clinique", label: "Clinique compagnie", desc: "Consultations, motifs, RDV, observance des traitements", module: "consultations", tone: "bg-brand-500" },
  { key: "rural", label: "Rural · rente", desc: "Visites, animaux vus, régions, problèmes, molécules", module: "missions", tone: "bg-orange-500" },
  { key: "actions", label: "Actions à mener", desc: "Par responsable, retards en premier", module: "dashboard", tone: "bg-error-500" },
  { key: "finances", label: "Finances", desc: "CA par activité, encaissé, dépenses, impayés", module: "finances", tone: "bg-gray-700" },
  { key: "recommandants", label: "Recommandants", desc: "Qui nous envoie des clients, sources", module: "clients", tone: "bg-success-500" },
  { key: "personnel", label: "Personnel", desc: "Absences, congés, objectifs", module: "dashboard", tone: "bg-theme-purple-500" },
];
const PRESETS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "Trimestre" },
  { days: 365, label: "12 mois" },
];

/* Briques d'affichage communes à l'écran et à l'impression (couleurs neutres pour le papier). */
function Kpis({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-gray-200 px-3 py-2 print:rounded-none">
          <p className="text-[11px] text-gray-500">{k}</p>
          <p className="text-base font-semibold text-gray-900 tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}
function Table({ head, rows, empty = "Rien à signaler." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="text-[12px] text-gray-500">{empty}</p>;
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>{head.map((h, i) => <th key={i} className={cn("border-b border-gray-300 px-1.5 py-1 text-start font-semibold", i > 0 && typeof rows[0][i] === "number" && "text-end")}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="break-inside-avoid">{r.map((c, j) => <td key={j} className={cn("border-b border-gray-100 px-1.5 py-1 align-top", typeof c === "number" && "text-end tabular-nums")}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
function Section({ title, tone, children }: { title: string; tone: string; children: ReactNode }) {
  return (
    <section className="cliva-rise mt-5 space-y-3 break-inside-avoid-page first:mt-0">
      <h2 className="flex items-center gap-2 border-b-2 border-gray-900 pb-1 text-[15px] font-bold text-gray-900">
        <span className={cn("size-2.5 rounded-full print:hidden", tone)} />
        {title}
      </h2>
      {children}
    </section>
  );
}
const Sub = ({ children }: { children: ReactNode }) => <h3 className="text-[12px] font-semibold tracking-wide text-gray-600 uppercase">{children}</h3>;

function ReportBody({ cats, p, est }: { cats: Cat[]; p: RPeriod; est?: string }) {
  const { db, today, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const tone = (k: Cat) => CATS.find((c) => c.key === k)!.tone;
  return (
    <div>
      {cats.includes("pharmacie") && (() => {
        const r = pharmacyReport(db, p, est);
        return (
          <Section title="Pharmacie · comptoir" tone={tone("pharmacie")}>
            <Kpis items={[["Ventes", r.sales], ["Chiffre d'affaires", formatXOF(r.total)], ["Panier moyen", formatXOF(r.basket)], ["Clients de passage", r.walkIn], ["Nouveaux clients au comptoir", r.newClients], ["Élevages enregistrés", r.herdsCaptured], ["Lots proches péremption", r.expiring], ["Lots périmés", r.expired]]} />
            <Sub>Produits les plus vendus</Sub>
            <Table head={["Produit", "Quantité", "Montant"]} rows={r.top.map((x) => [x.name, x.qty, formatXOF(x.amount)])} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
              <div className="space-y-1"><Sub>Pour quelles espèces</Sub><Table head={["Espèce", "Ventes"]} rows={r.bySpecies.map(([k, v]) => [k, v])} empty="Non renseigné." /></div>
              <div className="space-y-1"><Sub>Problèmes signalés</Sub><Table head={["Problème", "Ventes"]} rows={r.byPurpose.map(([k, v]) => [k, v])} empty="Non renseigné." /></div>
            </div>
            <Sub>Molécules les plus demandées (tous canaux)</Sub>
            <Table head={["Molécule / produit", "Demandes", "Quantité", "Source"]} rows={moleculeDemand(db, p).slice(0, 12).map((x) => [x.name, x.times, x.qty, x.sources])} />
            <Sub>Ruptures et stock faible</Sub>
            <Table head={["Article", "Stock", "Seuil"]} rows={r.lowStock.map((x) => [x.name, x.stock, x.threshold])} />
          </Section>
        );
      })()}

      {cats.includes("clients") && (() => {
        const r = clientsReport(db, p);
        return (
          <Section title="Clients et suivi" tone={tone("clients")}>
            <Kpis items={[["Clients actifs", r.total], ["Nouveaux sur la période", r.created], [ACTIVITY_META.compagnie.label, r.compagnie], [ACTIVITY_META.rente.label, r.rente], ["Compagnie + rente", r.both], ["Relances faites", r.touchesDone], ["Taux de joignabilité", `${r.reachRate} %`], ["Relances en retard", r.touchesLate]]} />
            <Sub>Besoins et problèmes remontés par les relances</Sub>
            <Table head={["Client", "Suivi", "Résultat", "Détail"]} rows={r.needs.map((x) => [x.client, x.label, x.outcome ? OUTCOME_LABELS[x.outcome] : "", x.note])} />
            <Sub>Prospects</Sub>
            <Kpis items={[["En cours", r.prospectsOpen], ["Convertis", r.prospectsWon], ["Perdus", r.prospectsLost.length], ["Taux de conversion", `${r.prospectsWon + r.prospectsLost.length ? Math.round((r.prospectsWon / (r.prospectsWon + r.prospectsLost.length)) * 100) : 0} %`]]} />
            {r.prospectsLost.length > 0 && <Table head={["Prospect perdu", "Raison"]} rows={r.prospectsLost.map((x) => [x.name, x.reason])} />}
          </Section>
        );
      })()}

      {cats.includes("clinique") && (() => {
        const r = clinicReport(db, p, est);
        return (
          <Section title="Clinique · animaux de compagnie" tone={tone("clinique")}>
            <Kpis items={[["Consultations", r.consultations], ["Validées", r.validated], ["Patients vus", r.patients], ["Hospitalisations", r.hospitalizations], ["Rendez-vous", r.appointments], ["Honorés", r.honored], ["Absences", r.absent], ["Décès", r.deaths]]} />
            {(() => {
              const tr = treatmentsReport(db, p);
              return (
                <>
                  <Sub>Traitements suivis</Sub>
                  <Kpis items={[["En clinique", tr.clinic.n], ["Observance clinique", tr.clinic.rate === null ? "—" : `${tr.clinic.rate} %`], ["À domicile", tr.home.n], ["Observance domicile", tr.home.rate === null ? "—" : `${tr.home.rate} %`]]} />
                  {tr.byUser.length > 0 && <Table head={["Membre de l'équipe", "Prises administrées"]} rows={tr.byUser.map((x) => [x.user, x.n])} />}
                </>
              );
            })()}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
              <div className="space-y-1"><Sub>Par espèce</Sub><Table head={["Espèce", "Consultations"]} rows={r.bySpecies.map(([k, v]) => [k, v])} /></div>
              <div className="space-y-1"><Sub>Motifs fréquents</Sub><Table head={["Motif", "Nombre"]} rows={r.byReason.map(([k, v]) => [k, v])} /></div>
            </div>
          </Section>
        );
      })()}

      {cats.includes("rural") && (() => {
        const r = ruralReport(db, p, est);
        return (
          <Section title="Rural · animaux de rente" tone={tone("rural")}>
            <Kpis items={[["Visites de ferme", r.farmVisits], ["Exploitations visitées", r.farmsVisited], ["Urgences", r.emergencies], ["Missions", r.missions], ["Animaux traités / vaccinés", r.animalsTreated.toLocaleString("fr-FR")], ["Animaux suivis (effectif)", r.heads.toLocaleString("fr-FR")], ["CA rural · rente", formatXOF(r.renteRevenue)], ["Rapports manquants", r.reportsMissing]]} />
            <Sub>Éleveurs par catégorie</Sub>
            <Kpis items={[["Petits éleveurs", r.scales.petit], ["Moyens éleveurs", r.scales.moyen], ["Gros éleveurs", r.scales.gros], ["Exploitations actives", r.farms]]} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
              <div className="space-y-1"><Sub>Animaux vus par espèce</Sub><Table head={["Espèce", "Vus en visite", "Traités", "Interventions"]} rows={r.animals.map(([k, v]) => [k, v.seen, v.treated, v.interventions])} empty="Aucun effectif relevé." /></div>
              <div className="space-y-1"><Sub>Régions visitées</Sub><Table head={["Région / zone", "Sorties", "Exploitations"]} rows={r.regions.map((x) => [x.region, x.visits, x.farms])} /></div>
              <div className="space-y-1"><Sub>Problèmes les plus fréquents</Sub><Table head={["Problème", "Fois"]} rows={r.problems.map(([k, v]) => [k, v])} empty="Non renseigné dans les rapports." /></div>
              <div className="space-y-1"><Sub>Molécules demandées (élevage)</Sub><Table head={["Molécule / produit", "Demandes", "Quantité", "Source"]} rows={r.molecules.map((x) => [x.name, x.times, x.qty, x.sources])} /></div>
            </div>
            <Sub>Sorties de la période</Sub>
            <Table head={["Réf.", "Type", "Date", "Exploitation", "Objet"]} rows={r.list.map((x) => [x.code, RURAL_LABEL[x.type], formatDate(x.date), x.farm, x.objective])} />
          </Section>
        );
      })()}

      {cats.includes("actions") && (() => {
        const rows = actionsReport(db, today);
        return (
          <Section title="Actions à mener" tone={tone("actions")}>
            <p className="text-[12px] text-gray-600">{rows.length} action(s) ouverte(s), dont <strong>{rows.filter((x) => x.late).length}</strong> en retard.</p>
            <Table head={["Responsable", "Type", "Action", "Échéance"]} rows={rows.map((x) => [x.who, x.kind, x.label, x.due ? <span className={x.late ? "font-semibold text-error-600 print:text-black print:underline" : ""}>{formatDate(x.due)}{x.late ? " · retard" : ""}</span> : "—"])} />
          </Section>
        );
      })()}

      {cats.includes("finances") && (() => {
        const r = financeReport(db, p, isDG, est);
        return (
          <Section title="Finances" tone={tone("finances")}>
            <Kpis items={[["Chiffre d'affaires", formatXOF(r.revenue)], ["Encaissé", formatXOF(r.collected)], ["Dépenses", formatXOF(r.expenses)], ["Résultat", formatXOF(r.result)], ["Clinique compagnie", formatXOF(r.split.compagnie)], ["Rural · rente", formatXOF(r.split.rente)], ["Pharmacie comptoir", formatXOF(r.split.pharmacie)], ["Impayés", formatXOF(r.unpaid)]]} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
              <div className="space-y-1"><Sub>Impayés par ancienneté</Sub><Table head={["Retard", "Montant"]} rows={Object.entries(r.aging).map(([k, v]) => [k, formatXOF(v)])} /></div>
              <div className="space-y-1"><Sub>Dépenses par catégorie</Sub><Table head={["Catégorie", "Montant"]} rows={r.byCategory.map(([k, v]) => [k, formatXOF(v)])} /></div>
            </div>
            {!isDG && <p className="text-[11px] text-gray-500">Dépenses confidentielles exclues (réservées au DG).</p>}
          </Section>
        );
      })()}

      {cats.includes("personnel") && (() => {
        const lv = (db.leaves ?? []).filter((l) => l.status === "approuvee" && l.start <= p.to && l.end >= p.from);
        const ob = (db.objectives ?? []).filter((o) => o.dueDate >= p.from || o.status === "en_cours");
        return (
          <Section title="Personnel" tone={tone("personnel")}>
            <Kpis items={[["Absences sur la période", lv.length], ["Jours de congé", lv.filter((l) => l.kind === "conge").reduce((s, l) => s + leaveDays(l), 0)], ["Permissions", lv.filter((l) => l.kind === "permission").length], ["Demandes en attente", (db.leaves ?? []).filter((l) => l.status === "en_attente").length]]} />
            <Sub>Absences</Sub>
            <Table head={["Membre", "Type", "Du", "Au"]} rows={lv.map((l) => [db.users.find((u) => u.id === l.userId)?.name ?? "", LEAVE_META[l.kind].label, formatDate(l.start), formatDate(l.end)])} />
            <Sub>Objectifs individuels</Sub>
            <Table head={["Membre", "Objectif", "Réalisé", "Cible", "État"]} rows={ob.map((o) => [db.users.find((u) => u.id === o.userId)?.name ?? "", o.title, o.current, o.target, OBJ_STATE[objectiveState(o, today)].label])} />
          </Section>
        );
      })()}

      {cats.includes("recommandants") && (() => {
        const r = referrersReport(db, p);
        return (
          <Section title="Recommandants et sources" tone={tone("recommandants")}>
            <Table head={["Recommandant", "Clients envoyés", "Sur la période", "CA généré", "Clients"]} rows={r.referrers.map((x) => [x.name, x.count, x.inPeriod, formatXOF(x.revenue), x.names.join(", ")])} empty="Aucun recommandant renseigné : notez « Recommandé par » sur la fiche client ou au comptoir." />
            <Sub>Comment les clients nous ont connus</Sub>
            <Table head={["Source", "Clients"]} rows={r.sources.map(([k, v]) => [k, v])} />
            <p className="text-[11px] text-gray-500">{r.unknown} client(s) sans source renseignée.</p>
          </Section>
        );
      })()}
    </div>
  );
}

export default function MeetingReportsPage() {
  const { can, today, establishment, db } = useDemo();
  const available = CATS.filter((c) => can(c.module));
  const [cats, setCats] = useState<Cat[]>(available.slice(0, 3).map((c) => c.key));
  const [days, setDays] = useState(30);
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [scope, setScope] = useState<"all" | "est">("all");
  const [print, setPrint] = useState(false);
  const p = useMemo(() => ({ from, to }), [from, to]);
  const est = scope === "est" ? establishment?.id : undefined;
  const toggle = (k: Cat) => setCats((s) => (s.includes(k) ? s.filter((x) => x !== k) : CATS.map((c) => c.key).filter((x) => x === k || s.includes(x))));
  const title = cats.length === 1 ? `Rapport — ${CATS.find((c) => c.key === cats[0])!.label}` : "Rapport de réunion";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Rapports de réunion"
        subtitle="Choisissez les rubriques et la période, puis imprimez pour la réunion"
        trail={[{ label: "Rapports", href: "/rapports" }]}
        actions={<Button size="sm" startIcon={<PrinterIcon />} onClick={() => setPrint(true)} disabled={!cats.length}>Imprimer / PDF</Button>}
      />
      <div className="space-y-3 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {available.map((c) => {
            const on = cats.includes(c.key);
            return (
              <button key={c.key} onClick={() => toggle(c.key)} aria-pressed={on} className={cn("cliva-press flex items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition", on ? "border-gray-800 bg-gray-50 dark:border-white/30 dark:bg-white/5" : "border-gray-200 hover:border-gray-300 dark:border-gray-800")}>
                <span className={cn("mt-1 size-3 shrink-0 rounded-full transition", c.tone, !on && "opacity-30")} />
                <span>
                  <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{c.label}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">{c.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((x) => (
            <button key={x.days} onClick={() => { setDays(x.days); setFrom(addDays(today, -x.days)); setTo(today); }} aria-pressed={days === x.days} className={cn("rounded-full border px-3 py-1 text-theme-xs font-medium", days === x.days ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400")}>
              {x.label}
            </button>
          ))}
          <input type="date" aria-label="Du" value={from} onChange={(e) => { setFrom(e.target.value); setDays(0); }} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
          <input type="date" aria-label="Au" value={to} onChange={(e) => { setTo(e.target.value); setDays(0); }} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
          <select aria-label="Établissement" value={scope} onChange={(e) => setScope(e.target.value as "all" | "est")} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
            <option value="all">Tous les établissements</option>
            <option value="est">{establishment?.name}</option>
          </select>
        </div>
      </div>

      {cats.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Sélectionnez au moins une rubrique.</p>
      ) : (
        <div className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 text-gray-900 sm:p-6">
          <p className="mb-4 text-sm text-gray-600">{title} · du {formatDate(from)} au {formatDate(to)} · {scope === "est" ? establishment?.name : "tous établissements"}</p>
          <ReportBody cats={cats} p={p} est={est} />
        </div>
      )}

      <PrintFrame open={print} onClose={() => setPrint(false)} title={title}>
        <PrintHeader title={title} sub={<p>Du {formatDate(from)} au {formatDate(to)} · {scope === "est" ? establishment?.name : "tous établissements"}</p>} />
        <div className="mt-4">
          <ReportBody cats={cats} p={p} est={est} />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
          <div className="border-t border-gray-400 pt-1">Décisions prises :</div>
          <div className="border-t border-gray-400 pt-1">Responsables et échéances :</div>
        </div>
        <p className="mt-4 text-[10px] text-gray-500">{db.settings.documentFooter}</p>
      </PrintFrame>
    </div>
  );
}
