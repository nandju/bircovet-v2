"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField, FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon, PrinterIcon } from "@/icons";
import { clientName, userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { PLAN_STATUS, planProgress, planTarget, PROPHY_KIND, PROPHY_KINDS, STEP_STATE, stepState } from "@/lib/prophylaxis";
import { addProphyStep, cancelProphyStep, closeProphyPlan, editProphyStep, markProphyStepDone, planToProgram, undoProphyStep } from "@/lib/services/prophylaxisService";
import type { ProphylaxisPlan, ProphyKind, ProphyPlanStep } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

type Panel = null | { mode: "done" | "edit"; step: ProphyPlanStep } | { mode: "add" } | { mode: "stop" } | { mode: "model" };

/** Fiche imprimable (A4 portrait) : le calendrier à remettre à l'éleveur ou au propriétaire. */
export function ProphySheet({ p }: { p: ProphylaxisPlan }) {
  const { db } = useDemo();
  const f = db.farms.find((x) => x.id === p.farmId);
  const pt = db.patients.find((x) => x.id === p.patientId);
  const owner = f ? clientName(db, f.clientId) : pt ? clientName(db, pt.ownerId) : "";
  const steps = p.steps.filter((s) => s.status !== "annule");
  return (
    <div className="text-[11px] leading-snug">
      <PrintHeader title={`Programme de prophylaxie ${p.code}`} sub={<p className="font-semibold">{p.name}</p>} />
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
        <p><strong>Pour :</strong> {planTarget(db, p)}</p>
        <p><strong>{f ? "Éleveur" : "Propriétaire"} :</strong> {owner || "—"}</p>
        <p><strong>Début :</strong> {formatDate(p.startDate)} ({p.startLabel})</p>
        <p><strong>Vétérinaire :</strong> {userName(db, p.vetId)}</p>
        {f && <p><strong>Lieu :</strong> {f.location}{f.managerPhone ? ` · Responsable : ${f.managerName} ${f.managerPhone}` : ""}</p>}
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-900 text-start">
            {["Date prévue", "Jour", "Action", "Produit · dose · voie", "Fait le", "Visa"].map((h) => <th key={h} className="py-1 pe-2 text-start font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1.5 pe-2 font-semibold tabular-nums">{formatDate(s.dueDate)}</td>
              <td className="py-1.5 pe-2 tabular-nums">J{s.day}</td>
              <td className="py-1.5 pe-2"><strong>{s.label}</strong><br />{PROPHY_KIND[s.kind].label}{s.note ? ` · ${s.note}` : ""}</td>
              <td className="py-1.5 pe-2">{[s.product, s.dose, s.route].filter(Boolean).join(" · ") || "—"}</td>
              <td className="py-1.5 pe-2 tabular-nums">{s.doneDate ? formatDate(s.doneDate) : <span className="inline-block w-16 border-b border-gray-400">&nbsp;</span>}</td>
              <td className="py-1.5"><span className="inline-block w-14 border-b border-gray-400">&nbsp;</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.note && <p className="mt-3 whitespace-pre-line"><strong>Remarques :</strong> {p.note}</p>}
      <p className="mt-4 text-[10px] text-gray-600">Respectez les dates, les doses et les délais d&apos;attente (lait, œufs, viande) indiqués par votre vétérinaire. En cas de mortalité, de baisse d&apos;appétit ou de ponte, appelez le cabinet sans attendre la prochaine action.</p>
    </div>
  );
}

export default function PlanDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { db, run, today, user } = useDemo();
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [print, setPrint] = useState(false);
  const p = id ? (db.prophylaxisPlans ?? []).find((x) => x.id === id) : undefined;
  if (!p) return null;
  const prog = planProgress(p);
  const canFix = user?.roleId === "dg" || user?.roleId === "vet";
  const s = (k: string) => String(form[k] ?? "");
  const set = (k: string) => (v: string | boolean) => setForm((x) => ({ ...x, [k]: v }));
  const open = (pn: Panel) => {
    if (pn && "step" in pn) setForm(pn.mode === "done" ? { date: pn.step.dueDate <= today ? pn.step.dueDate : today, product: pn.step.product ?? "", note: "", lotRef: "" } : { dueDate: pn.step.dueDate, label: pn.step.label, kind: pn.step.kind, product: pn.step.product ?? "", dose: pn.step.dose ?? "", route: pn.step.route ?? "", note: pn.step.note ?? "", shift: true });
    else if (pn?.mode === "add") setForm({ dueDate: today, label: "", kind: "vaccination", product: "", dose: "", route: "", note: "" });
    else if (pn?.mode === "model") setForm({ name: `${p.name} (adapté)` });
    else setForm({});
    setPanel(pn);
  };
  const submit = () => {
    if (!panel) return;
    let ok = false;
    if (panel.mode === "done") ok = run(markProphyStepDone, { planId: p.id, stepId: panel.step.id, date: s("date"), note: s("note"), lotRef: s("lotRef"), product: s("product") }).ok;
    if (panel.mode === "edit") ok = run(editProphyStep, { planId: p.id, stepId: panel.step.id, dueDate: s("dueDate"), label: s("label"), kind: s("kind") as ProphyKind, product: s("product"), dose: s("dose"), route: s("route"), note: s("note"), shiftFollowing: !!form.shift }).ok;
    if (panel.mode === "add") ok = run(addProphyStep, { planId: p.id, step: { dueDate: s("dueDate"), label: s("label"), kind: s("kind") as ProphyKind, product: s("product") || undefined, dose: s("dose") || undefined, route: s("route") || undefined, note: s("note") || undefined } }).ok;
    if (panel.mode === "stop") ok = run(closeProphyPlan, { planId: p.id, note: s("note") }).ok;
    if (panel.mode === "model") ok = run(planToProgram, { planId: p.id, name: s("name") }).ok;
    if (ok) setPanel(null);
  };
  const editing = panel && panel.mode !== "stop" && panel.mode !== "model" && panel.mode !== "done";
  return (
    <>
      <AppModal
        isOpen
        onClose={onClose}
        size="xl"
        title={`${p.code} · ${p.name}`}
        description={`${planTarget(db, p)} · début le ${formatDate(p.startDate)} (${p.startLabel})`}
        footer={
          <>
            {p.status === "en_cours" && canFix && <Button variant="ghost" onClick={() => open({ mode: "stop" })}>Arrêter le programme</Button>}
            {p.status === "arrete" && canFix && <Button variant="ghost" onClick={() => run(closeProphyPlan, { planId: p.id, reopen: true })}>Reprendre le programme</Button>}
            {canFix && <Button variant="outline" onClick={() => open({ mode: "model" })}>Enregistrer comme modèle</Button>}
            <Button variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer</Button>
            {p.status !== "arrete" && <Button startIcon={<PlusIcon />} onClick={() => open({ mode: "add" })}>Ajouter une action</Button>}
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PLAN_STATUS[p.status].tone)}>{PLAN_STATUS[p.status].label}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300"><strong className="tabular-nums">{prog.done}/{prog.total}</strong> actions faites</span>
            <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement du programme"><div className="h-full rounded-full bg-brand-500" style={{ width: `${prog.pct}%` }} /></div>
            {prog.next && <span className="text-theme-sm text-gray-600 dark:text-gray-400">Prochaine : <strong>{prog.next.label}</strong> le {formatDate(prog.next.dueDate)}</span>}
          </div>
          {p.note && <p className="whitespace-pre-line rounded-xl bg-yellow-50 px-3 py-2 text-theme-sm text-yellow-900 dark:bg-yellow-500/10 dark:text-yellow-200">{p.note}</p>}

          {panel && (
            <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {panel.mode === "done" && `Noter comme fait : ${panel.step.label}`}
                {panel.mode === "edit" && `Modifier : ${panel.step.label}`}
                {panel.mode === "add" && "Nouvelle action"}
                {panel.mode === "stop" && "Arrêter le programme"}
                {panel.mode === "model" && "Enregistrer ce programme comme modèle réutilisable"}
              </h4>
              {panel.mode === "done" && (
                <FormGrid cols={2}>
                  <TextField label="Fait le" type="date" value={s("date")} onChange={set("date")} max={today} />
                  <TextField label="Produit utilisé" value={s("product")} onChange={set("product")} />
                  <TextField label="N° de lot du vaccin (facultatif)" value={s("lotRef")} onChange={set("lotRef")} />
                  <TextField label="Remarque (facultatif)" value={s("note")} onChange={set("note")} placeholder="Ex. 3 sujets absents" />
                </FormGrid>
              )}
              {editing && (
                <>
                  <FormGrid cols={3}>
                    <TextField label="Date prévue" type="date" value={s("dueDate")} onChange={set("dueDate")} />
                    <SelectField label="Type" value={s("kind")} onChange={set("kind")} options={PROPHY_KINDS} />
                    <TextField label="Action" value={s("label")} onChange={set("label")} />
                    <TextField label="Produit" value={s("product")} onChange={set("product")} />
                    <TextField label="Dose" value={s("dose")} onChange={set("dose")} />
                    <TextField label="Voie" value={s("route")} onChange={set("route")} />
                  </FormGrid>
                  <TextField label="Remarque" value={s("note")} onChange={set("note")} />
                  {panel.mode === "edit" && <CheckField label="Décaler aussi les actions suivantes du même nombre de jours" checked={!!form.shift} onChange={set("shift")} hint="Utile quand une vaccination est reportée : le reste du calendrier suit." />}
                </>
              )}
              {panel.mode === "stop" && <TextAreaField label="Motif (facultatif)" rows={2} value={s("note")} onChange={set("note")} placeholder="Bande vendue, animal décédé, changement de programme…" />}
              {panel.mode === "model" && <TextField label="Nom du nouveau modèle" value={s("name")} onChange={set("name")} hint="Reprend les actions telles qu'elles sont ici, avec vos modifications, pour les prochains cas." />}
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Annuler</Button>
                <Button size="sm" onClick={submit}>{panel.mode === "done" ? "Confirmer" : panel.mode === "stop" ? "Arrêter" : "Enregistrer"}</Button>
              </div>
            </div>
          )}

          <ol className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {p.steps.map((x) => {
              const st = stepState(x, today);
              return (
                <li key={x.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap", st === "annule" && "opacity-60")}>
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">{formatDate(x.dueDate)}</p>
                    <p className="text-theme-xs tabular-nums text-gray-500">J{x.day}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROPHY_KIND[x.kind].tone)}>{PROPHY_KIND[x.kind].label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STEP_STATE[st].tone)}>{STEP_STATE[st].label}{x.doneDate ? ` le ${formatDate(x.doneDate)}` : ""}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{x.label}</p>
                    <p className="text-theme-xs text-gray-500">{[x.product, x.dose, x.route, x.note, x.lotRef && `lot ${x.lotRef}`, x.doneNote, x.doneById && `par ${userName(db, x.doneById)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex w-full shrink-0 flex-wrap justify-end gap-1.5 sm:w-auto">
                    {x.status === "a_faire" && p.status !== "arrete" && (
                      <>
                        <Button size="xs" onClick={() => open({ mode: "done", step: x })}>Fait</Button>
                        <Button size="xs" variant="outline" onClick={() => open({ mode: "edit", step: x })}>Modifier / reporter</Button>
                        <Button size="xs" variant="ghost" onClick={() => run(cancelProphyStep, { planId: p.id, stepId: x.id })}>Retirer</Button>
                      </>
                    )}
                    {x.status === "fait" && canFix && <Button size="xs" variant="ghost" onClick={() => run(undoProphyStep, { planId: p.id, stepId: x.id })}>Annuler la saisie</Button>}
                    {x.status === "annule" && <Button size="xs" variant="ghost" onClick={() => run(cancelProphyStep, { planId: p.id, stepId: x.id, restore: true })}>Rétablir</Button>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-theme-xs text-gray-500">Une action notée « faite » rejoint l&apos;historique : interventions de l&apos;exploitation, ou carnet de vaccination de l&apos;animal.</p>
        </div>
      </AppModal>
      <PrintFrame open={print} onClose={() => setPrint(false)} title={`Prophylaxie ${p.code}`}>
        <ProphySheet p={p} />
      </PrintFrame>
    </>
  );
}
