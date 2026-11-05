"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField, FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { DEFAULT_FOLLOWUP, fillTemplate, PERIODIC_STAGE, settingsOf } from "@/lib/followup";
import { deleteTemplate, saveTemplate, updateFollowUpSettings } from "@/lib/services/followUpService";
import type { FollowUpSettings, MessageTemplate } from "@/lib/types";
import { useEffect, useState } from "react";

const CONTEXTS: { key: NonNullable<MessageTemplate["context"]>; title: string; desc: string }[] = [
  { key: "compagnie", title: "Clinique · animaux de compagnie", desc: "Relances après consultation, chirurgie ou hospitalisation." },
  { key: "rente", title: "Rural · animaux de rente", desc: "Relances après visite de ferme, urgence ou mission." },
  { key: "prospect", title: "Prospects", desc: "Premier contact, relance et proposition." },
  { key: "general", title: "Autres messages", desc: "Rappels de rendez-vous, vaccins, factures." },
];

const VARS = [
  { key: "client", label: "Nom du client" },
  { key: "patient", label: "Nom de l'animal" },
  { key: "exploitation", label: "Exploitation" },
  { key: "motif", label: "Motif" },
  { key: "clinique", label: "Clinique" },
  { key: "veterinaire", label: "Votre nom" },
];
const SAMPLE = { client: "Aminata Coulibaly", patient: "Bella", exploitation: "Ferme Les Palmiers", motif: "otite", clinique: "Cliva", veterinaire: "Dr Aya Kouassi" };

const stageOrder = (s?: string) => (s === PERIODIC_STAGE ? 9999 : s && /^J\d+$/.test(s) ? Number(s.slice(1)) : 5000);

function TemplateModal({ tpl, onClose }: { tpl: Partial<MessageTemplate> | null; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState<Partial<MessageTemplate>>({});
  useEffect(() => {
    if (tpl) setV({ channel: "whatsapp", context: "compagnie", ...tpl });
  }, [tpl]);
  if (!tpl) return null;
  const insert = (k: string) => {
    const el = document.getElementById("tpl-body") as HTMLTextAreaElement | null;
    const body = v.body ?? "";
    const pos = el?.selectionStart ?? body.length;
    setV({ ...v, body: `${body.slice(0, pos)}{${k}}${body.slice(pos)}` });
  };
  const save = () => run(saveTemplate, { id: v.id, name: v.name ?? "", body: v.body ?? "", channel: v.channel ?? "whatsapp", stage: v.stage || undefined, context: v.context }).ok && onClose();
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={v.id ? "Modifier le modèle" : "Nouveau modèle"}
      footer={
        <>
          {v.id && !v.id.startsWith("fu-") && (
            <Button size="sm" variant="ghost" onClick={() => run(deleteTemplate, { id: v.id! }).ok && onClose()}>
              Supprimer
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.name?.trim() || !v.body?.trim()}>Enregistrer</Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Nom" required value={v.name ?? ""} onChange={(x) => setV({ ...v, name: x })} className="sm:col-span-2" />
        <SelectField label="Usage" value={v.context ?? "general"} onChange={(x) => setV({ ...v, context: x as MessageTemplate["context"] })} options={CONTEXTS.map((c) => ({ value: c.key, label: c.title }))} />
        <TextField label="Étape (facultatif)" value={v.stage ?? ""} onChange={(x) => setV({ ...v, stage: x })} hint="J0, J3, J7… ou « periodique »" />
        <div className="sm:col-span-2">
          <label htmlFor="tpl-body" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Message</label>
          <textarea id="tpl-body" value={v.body ?? ""} onChange={(e) => setV({ ...v, body: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-white/90" />
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-gray-500">Insérer :</span>
            {VARS.map((x) => (
              <button key={x.key} type="button" onClick={() => insert(x.key)} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-gray-500 uppercase">Aperçu</p>
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm whitespace-pre-line text-gray-800 dark:bg-brand-500/10 dark:text-gray-200">{fillTemplate(v.body ?? "", SAMPLE) || "…"}</p>
        </div>
      </FormGrid>
    </AppModal>
  );
}

function CadenceCard() {
  const { db, run, can } = useDemo();
  const [s, setS] = useState<FollowUpSettings>(settingsOf(db));
  useEffect(() => setS(settingsOf(db)), [db]);
  const editable = can("relation", "update");
  const setStep = (i: number, patch: Partial<FollowUpSettings["steps"][number]>) => setS({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 dark:border-gray-800 dark:bg-white/3">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Cadence des relances</h3>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Appliquée à chaque nouveau suivi. Les suivis déjà démarrés gardent leurs dates.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-start text-theme-xs text-gray-500">
              <th className="pb-2 text-start font-medium">Étape</th>
              <th className="pb-2 text-start font-medium">Jour</th>
              <th className="pb-2 text-start font-medium">Objectif</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.steps.map((st, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5 pe-2 font-mono text-theme-xs font-semibold">J{st.day}</td>
                <td className="py-1.5 pe-2">
                  <input type="number" min={0} value={st.day} disabled={!editable} onChange={(e) => setStep(i, { day: Number(e.target.value), stage: `J${Number(e.target.value)}` })} aria-label={`Jour de l'étape ${i + 1}`} className="h-8 w-20 rounded-md border border-gray-200 bg-transparent px-2 tabular-nums dark:border-gray-700 dark:text-white/90" />
                </td>
                <td className="py-1.5 pe-2">
                  <input value={st.label} disabled={!editable} onChange={(e) => setStep(i, { label: e.target.value })} aria-label={`Objectif de l'étape ${i + 1}`} className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2 dark:border-gray-700 dark:text-white/90" />
                </td>
                <td className="py-1.5 text-end">
                  {editable && s.steps.length > 1 && (
                    <button onClick={() => setS({ ...s, steps: s.steps.filter((_, j) => j !== i) })} className="text-theme-xs text-gray-400 hover:text-error-600">Retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button onClick={() => { const d = (s.steps[s.steps.length - 1]?.day ?? 0) + 30; setS({ ...s, steps: [...s.steps, { day: d, stage: `J${d}`, label: "Prise de nouvelles" }] }); }} className="mt-2 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          + Ajouter une étape
        </button>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <NumberField label="Puis prendre des nouvelles tous les" value={s.recurringDays} onChange={(x) => setS({ ...s, recurringDays: x })} min={60} max={365} step={10} suffix="jours" disabled={!editable} />
          <div className="mt-1.5 flex gap-1">
            {[120, 150, 180].map((d) => (
              <button key={d} type="button" disabled={!editable} onClick={() => setS({ ...s, recurringDays: d })} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400">
                {d / 30} mois
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Démarrer un suivi automatiquement après</p>
          <CheckField label="Validation d'une consultation" checked={s.autoStart.consultation} onChange={(x) => setS({ ...s, autoStart: { ...s.autoStart, consultation: x } })} disabled={!editable} />
          <CheckField label="Sortie d'hospitalisation" checked={s.autoStart.hospitalisation} onChange={(x) => setS({ ...s, autoStart: { ...s.autoStart, hospitalisation: x } })} disabled={!editable} />
          <CheckField label="Fin d'une mission terrain ou visite de ferme" checked={s.autoStart.mission} onChange={(x) => setS({ ...s, autoStart: { ...s.autoStart, mission: x } })} disabled={!editable} />
        </div>
      </div>
      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run(updateFollowUpSettings, s)}>Enregistrer la cadence</Button>
          <Button size="sm" variant="ghost" onClick={() => setS(DEFAULT_FOLLOWUP)}>Revenir à J0-J3-J7-J14-J30-J60-J120</Button>
        </div>
      )}
    </section>
  );
}

export default function FollowUpTemplates() {
  const { db, can } = useDemo();
  const [edit, setEdit] = useState<Partial<MessageTemplate> | null>(null);
  const editable = can("relation", "update");
  return (
    <div className="space-y-4">
      <CadenceCard />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Modèles de messages</h3>
        {editable && (
          <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({})}>
            Nouveau modèle
          </Button>
        )}
      </div>
      {CONTEXTS.map((c) => {
        const list = db.templates.filter((t) => (t.context ?? "general") === c.key).sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage));
        if (!list.length) return null;
        return (
          <section key={c.key} className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <header className="px-4 py-3 sm:px-5">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{c.title}</h4>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">{c.desc}</p>
            </header>
            <ul>
              {list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-start gap-3 border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-800">
                  <span className="inline-flex min-w-11 justify-center rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300">{t.stage === PERIODIC_STAGE ? "4-6 m" : (t.stage ?? "—")}</span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t.name}</p>
                    <p className="mt-0.5 text-theme-xs text-gray-600 dark:text-gray-400">{t.body}</p>
                  </div>
                  {editable && (
                    <Button size="xs" variant="ghost" onClick={() => setEdit(t)}>
                      Modifier
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <TemplateModal tpl={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
