"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SpeciesIcon from "@/components/common/SpeciesIcon";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { formatDate } from "@/lib/format";
import { COMPANION, dueActions, planTarget, PROPHY_KIND, STEP_STATE, type DueAction } from "@/lib/prophylaxis";
import { markProphyStepDone, setProgramActive } from "@/lib/services/prophylaxisService";
import type { ProphylaxisProgram } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import AssignModal, { type AssignPrefill } from "./AssignModal";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";
import ProgramEditor, { EMPTY_PROGRAM } from "./ProgramEditor";
import type { ProgramInput } from "@/lib/services/prophylaxisService";

const sel = "h-9 rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

function ProgramSheet({ p }: { p: ProphylaxisProgram }) {
  return (
    <div className="text-[11px] leading-snug">
      <PrintHeader title={`Modèle ${p.code}`} sub={<p className="font-semibold">{p.name}</p>} />
      <p className="mt-3"><strong>Espèce :</strong> {p.species}{p.category ? ` · ${p.category}` : ""} · <strong>Départ :</strong> {p.startLabel}</p>
      {p.description && <p className="mt-1">{p.description}</p>}
      <table className="mt-3 w-full border-collapse">
        <thead><tr className="border-b border-gray-900">{["Jour", "Type", "Action", "Produit · dose · voie", "Remarque"].map((h) => <th key={h} className="py-1 pe-2 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {p.steps.map((s) => (
            <tr key={s.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1.5 pe-2 font-semibold tabular-nums">J{s.day}</td>
              <td className="py-1.5 pe-2">{PROPHY_KIND[s.kind].label}</td>
              <td className="py-1.5 pe-2">{s.label}</td>
              <td className="py-1.5 pe-2">{[s.product, s.dose, s.route].filter(Boolean).join(" · ") || "—"}</td>
              <td className="py-1.5">{s.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DueRow({ a, onOpen }: { a: DueAction; onOpen: () => void }) {
  const { db, run, today, can } = useDemo();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap">
      <div className="w-24 shrink-0">
        <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">{formatDate(a.step.dueDate)}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STEP_STATE[a.state].tone)}>{STEP_STATE[a.state].label}</span>
      </div>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROPHY_KIND[a.step.kind].tone)}>{PROPHY_KIND[a.step.kind].label}</span>
          {a.step.label}
        </p>
        <p className="flex items-center gap-1 truncate text-theme-sm text-gray-600 dark:text-gray-400"><SpeciesIcon species={a.plan.species} />{planTarget(db, a.plan)}</p>
        <p className="text-theme-xs text-gray-500">{[a.plan.code, a.step.product, a.step.dose, a.step.route].filter(Boolean).join(" · ")}</p>
      </button>
      <div className="flex w-full shrink-0 justify-end gap-1.5 sm:w-auto">
        {(can("exploitations", "update") || can("patients", "update")) && a.step.dueDate <= today && <Button size="xs" onClick={() => run(markProphyStepDone, { planId: a.plan.id, stepId: a.step.id, date: today })}>Fait aujourd&apos;hui</Button>}
        <Button size="xs" variant="outline" onClick={onOpen}>Ouvrir</Button>
      </div>
    </li>
  );
}

export default function ProphylaxisPage() {
  const { db, today, can, user } = useDemo();
  const [tab, setTab] = useState("todo");
  const [scope, setScope] = useState<"all" | "farm" | "pet">("all");
  const [horizon, setHorizon] = useState(30);
  const [status, setStatus] = useState<"en_cours" | "fini">("en_cours");
  const [assign, setAssign] = useState<AssignPrefill | null>(null);
  const [edit, setEdit] = useState<ProgramInput | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [printPg, setPrintPg] = useState<ProphylaxisProgram | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const isPet = (sp: string) => COMPANION.includes(sp);
  const keep = (sp: string, target?: string) => scope === "all" || (scope === "pet" ? target === "patient" || isPet(sp) : target !== "patient" && !isPet(sp));
  const todo = dueActions(db, today, horizon).filter((a) => keep(a.plan.species, a.plan.target));
  const groups: [string, DueAction[]][] = [
    ["En retard", todo.filter((a) => a.state === "en_retard")],
    ["Aujourd'hui", todo.filter((a) => a.state === "aujourdhui")],
    ["Cette semaine", todo.filter((a) => a.state === "bientot")],
    [`D'ici ${horizon} jours`, todo.filter((a) => a.state === "a_venir")],
  ];
  const plans = (db.prophylaxisPlans ?? []).filter((p) => keep(p.species, p.target) && (status === "en_cours" ? p.status === "en_cours" : p.status !== "en_cours"));
  const programs = (db.prophylaxisPrograms ?? []).filter((p) => (showArchived ? !p.active : p.active) && keep(p.species));
  const editModels = user?.roleId === "dg" || user?.roleId === "vet";
  const late = groups[0][1].length;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Prophylaxie"
        subtitle="Programmes de vaccins, déparasitages et soins préventifs, avec les dates de chaque action"
        actions={
          <>
            {editModels && <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => setEdit({ ...EMPTY_PROGRAM, steps: [] })}>Nouveau modèle</Button>}
            {(can("exploitations", "update") || can("patients", "update")) && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setAssign({})}>Appliquer un programme</Button>}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "todo", label: "À faire", count: todo.filter((a) => a.state !== "a_venir").length },
            { key: "plans", label: "Programmes appliqués", count: (db.prophylaxisPlans ?? []).filter((p) => p.status === "en_cours").length },
            { key: "models", label: "Modèles", count: (db.prophylaxisPrograms ?? []).filter((p) => p.active).length },
          ]}
        />
        <select aria-label="Animaux" className={sel} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="all">Tous les animaux</option>
          <option value="farm">Élevages</option>
          <option value="pet">Animaux de compagnie</option>
        </select>
        {tab === "todo" && (
          <select aria-label="Horizon" className={sel} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[7, 30, 90].map((d) => <option key={d} value={d}>{d} prochains jours</option>)}
          </select>
        )}
        {tab === "plans" && (
          <select aria-label="Statut" className={sel} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="en_cours">En cours</option>
            <option value="fini">Terminés ou arrêtés</option>
          </select>
        )}
        {tab === "models" && <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Modèles archivés</label>}
      </div>

      {tab === "todo" && (
        <div className="space-y-4">
          {late > 0 && <p className="rounded-2xl bg-error-50 px-4 py-3 text-sm text-error-800 dark:bg-error-500/10 dark:text-error-300"><strong>{late} action(s) en retard.</strong> Notez-les faites si elles ont été réalisées, ou reportez-les : le reste du calendrier peut suivre.</p>}
          {groups.filter(([, l]) => l.length).map(([title, list]) => (
            <section key={title}>
              <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">{title} <span className="font-normal text-gray-500">({list.length})</span></h3>
              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-cliva dark:divide-gray-800 dark:border-gray-800 dark:bg-white/3">
                {list.map((a) => <DueRow key={a.step.id} a={a} onOpen={() => setPlanId(a.plan.id)} />)}
              </ul>
            </section>
          ))}
          {!todo.length && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Rien à faire sur cette période. Appliquez un programme à une bande, un cheptel ou un animal pour voir ses dates ici.</p>}
        </div>
      )}

      {tab === "plans" && <PlanList plans={plans} onOpen={setPlanId} empty="Aucun programme pour ce filtre." />}

      {tab === "models" && (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {programs.map((p) => {
            const last = p.steps.at(-1)?.day ?? 0;
            const used = (db.prophylaxisPlans ?? []).filter((x) => x.programId === p.id).length;
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
                <div>
                  <p className="text-theme-xs text-gray-500">{p.code} · {p.species}{p.category ? ` · ${p.category}` : ""}</p>
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-800 dark:text-white/90"><SpeciesIcon species={p.species} />{p.name}</h3>
                  <p className="text-theme-sm text-gray-500">{p.steps.length} actions sur {last} jours · départ : {p.startLabel}{used ? ` · appliqué ${used} fois` : ""}</p>
                </div>
                <ol className="space-y-0.5 text-theme-sm text-gray-700 dark:text-gray-300">
                  {p.steps.slice(0, 4).map((s) => <li key={s.id}><span className="inline-block w-12 tabular-nums text-gray-500">J{s.day}</span>{s.label}</li>)}
                  {p.steps.length > 4 && <li className="text-gray-500">… et {p.steps.length - 4} autre(s)</li>}
                </ol>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {(can("exploitations", "update") || can("patients", "update")) && p.active && <Button size="xs" onClick={() => setAssign({ programId: p.id })}>Appliquer</Button>}
                  {editModels && <Button size="xs" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, species: p.species, category: p.category, startLabel: p.startLabel, description: p.description, steps: p.steps })}>Modifier</Button>}
                  {editModels && <Button size="xs" variant="outline" onClick={() => setEdit({ name: `${p.name} (copie)`, species: p.species, category: p.category, startLabel: p.startLabel, description: p.description, steps: p.steps.map((s) => ({ ...s, id: "" })) })}>Dupliquer</Button>}
                  <Button size="xs" variant="ghost" onClick={() => setPrintPg(p)}>Imprimer</Button>
                  {editModels && <ArchiveButton id={p.id} active={p.active} />}
                </div>
              </li>
            );
          })}
          {!programs.length && <li className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucun modèle.</li>}
        </ul>
      )}

      <AssignModal prefill={assign} onClose={() => setAssign(null)} onSaved={(id) => { setTab("plans"); setStatus("en_cours"); setPlanId(id); }} />
      <ProgramEditor value={edit} onClose={() => setEdit(null)} onSaved={() => setTab("models")} />
      <PlanDetail id={planId} onClose={() => setPlanId(null)} />
      <PrintFrame open={!!printPg} onClose={() => setPrintPg(null)} title="Modèle de prophylaxie">{printPg && <ProgramSheet p={printPg} />}</PrintFrame>
    </div>
  );
}

function ArchiveButton({ id, active }: { id: string; active: boolean }) {
  const { run } = useDemo();
  return <Button size="xs" variant="ghost" onClick={() => run(setProgramActive, { id, active: !active })}>{active ? "Archiver" : "Réactiver"}</Button>;
}
