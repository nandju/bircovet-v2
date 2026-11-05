"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { CopyIcon } from "@/icons";
import { fillTemplate, OUTCOME_LABELS, planVars, templateFor, waNumber } from "@/lib/followup";
import { addDays, formatDate } from "@/lib/format";
import { completeTouch, convertProspect, createProspect, logProspectContact, moveProspect, postponeTouch, skipTouch, startFollowUp, stopPlan, updateProspect, type ProspectInput } from "@/lib/services/followUpService";
import type { FollowUpPlan, FollowUpTouch, Interaction, Prospect, TouchOutcome } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

export const CHANNELS: { value: Interaction["channel"]; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "appel", label: "Appel" },
  { value: "sms", label: "SMS" },
  { value: "visite", label: "Visite / sur place" },
  { value: "email", label: "E-mail" },
];
export const channelLabel = (c?: string) => CHANNELS.find((x) => x.value === c)?.label ?? c ?? "";

const OUTCOMES: { value: TouchOutcome; label: string; tone: string }[] = [
  { value: "rassure", label: OUTCOME_LABELS.rassure, tone: "peer-checked:border-success-500 peer-checked:bg-success-50 peer-checked:text-success-700 dark:peer-checked:bg-success-500/15 dark:peer-checked:text-success-300" },
  { value: "rdv_pris", label: OUTCOME_LABELS.rdv_pris, tone: "peer-checked:border-tertiary-500 peer-checked:bg-tertiary-50 peer-checked:text-tertiary-700 dark:peer-checked:bg-tertiary-500/15 dark:peer-checked:text-tertiary-300" },
  { value: "besoin", label: OUTCOME_LABELS.besoin, tone: "peer-checked:border-warning-500 peer-checked:bg-warning-50 peer-checked:text-warning-700 dark:peer-checked:bg-warning-500/15 dark:peer-checked:text-warning-300" },
  { value: "a_revoir", label: OUTCOME_LABELS.a_revoir, tone: "peer-checked:border-error-500 peer-checked:bg-error-50 peer-checked:text-error-700 dark:peer-checked:bg-error-500/15 dark:peer-checked:text-error-300" },
  { value: "injoignable", label: OUTCOME_LABELS.injoignable, tone: "peer-checked:border-gray-500 peer-checked:bg-gray-100 peer-checked:text-gray-800 dark:peer-checked:bg-white/10 dark:peer-checked:text-white" },
];

export function waLink(phoneCode: string | undefined, phone: string, text: string) {
  const n = waNumber(phoneCode, phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "";
}

/** Copie dans le presse-papiers ; sélectionne le texte si l'accès est refusé. */
export function CopyButton({ text, targetId, label = "Copier" }: { text: string; targetId?: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      const el = targetId ? (document.getElementById(targetId) as HTMLTextAreaElement | null) : null;
      el?.select();
    }
  };
  return (
    <Button size="xs" variant="ghost" startIcon={<CopyIcon />} onClick={copy}>
      {done ? "Copié" : label}
    </Button>
  );
}

export function ChannelPicker({ value, onChange }: { value: Interaction["channel"]; onChange: (v: Interaction["channel"]) => void }) {
  return (
    <div role="radiogroup" aria-label="Canal utilisé" className="flex flex-wrap gap-1.5">
      {CHANNELS.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          onClick={() => onChange(c.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-theme-xs font-medium transition",
            value === c.value ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export interface TouchTarget {
  plan: FollowUpPlan;
  touch: FollowUpTouch;
  channel: Interaction["channel"];
}

/**
 * Relance : message prêt à envoyer (modifiable), envoi WhatsApp ou appel,
 * puis enregistrement obligatoire du résultat dans l'historique du client.
 */
export function TouchContactModal({ target, onClose }: { target: TouchTarget | null; onClose: () => void }) {
  const { db, run, user } = useDemo();
  const [channel, setChannel] = useState<Interaction["channel"]>("whatsapp");
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<TouchOutcome | "">("");
  const [note, setNote] = useState("");
  const client = target ? db.clients.find((c) => c.id === target.plan.clientId) : undefined;
  useEffect(() => {
    if (!target) return;
    const tpl = templateFor(db, target.plan.context, target.touch.stage);
    setText(tpl ? fillTemplate(tpl.body, planVars(db, target.plan, user?.name)) : "");
    setChannel(target.channel);
    setOutcome("");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  if (!target || !client) return null;
  const link = waLink(client.phoneCode, client.phone, text);
  const needsNote = outcome === "a_revoir" || outcome === "besoin";
  const save = () => {
    if (!outcome) return;
    const r = run(completeTouch, { planId: target.plan.id, touchId: target.touch.id, channel, outcome, note });
    if (r.ok) onClose();
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="md"
      title={`Relance ${target.touch.stage === "periodique" ? "périodique" : target.touch.stage} · ${target.touch.label}`}
      description={`${client.name} — ${target.plan.label}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!outcome || (needsNote && !note.trim())}>Enregistrer le contact</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">1. Contacter le client</p>
          <ChannelPicker value={channel} onChange={setChannel} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
            <span className="text-gray-500 dark:text-gray-400">Téléphone</span>
            <span className="font-semibold text-gray-800 tabular-nums select-all dark:text-white/90">
              {client.phoneCode} {client.phone}
            </span>
            <CopyButton text={`${client.phoneCode} ${client.phone}`} label="Copier le numéro" />
          </div>
          {channel !== "appel" && channel !== "visite" && (
            <>
              <TextAreaField label="Message (modifiable avant envoi)" value={text} onChange={setText} rows={4} />
              <div className="flex flex-wrap items-center gap-2">
                {channel === "whatsapp" && link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-success-600 px-3 py-2 text-sm font-medium text-white hover:bg-success-700">
                    Ouvrir WhatsApp avec ce message
                  </a>
                )}
                <CopyButton text={text} label="Copier le message" />
              </div>
            </>
          )}
          {channel === "appel" && <p className="text-theme-xs text-gray-500 dark:text-gray-400">Appelez le numéro ci-dessus, puis notez ce que le client vous a dit.</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">2. Résultat de l&apos;échange</p>
          <div role="radiogroup" aria-label="Résultat" className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <label key={o.value} className="cursor-pointer">
                <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="peer sr-only" />
                <span className={cn("inline-block rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 dark:border-gray-700 dark:text-gray-300", o.tone)}>{o.label}</span>
              </label>
            ))}
          </div>
          {outcome === "injoignable" && (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Une nouvelle tentative sera programmée dans 2 jours (essai {target.touch.attempts + 1}/3).
            </p>
          )}
          {needsNote && <p className="text-theme-xs text-warning-700 dark:text-warning-400">Une tâche sera créée pour le responsable du suivi.</p>}
          <TextAreaField label={needsNote ? "Problème ou besoin exprimé" : "Note (facultatif)"} required={needsNote} value={note} onChange={setNote} rows={2} placeholder="Ex. : mange mieux, fin du traitement samedi ; souhaite un devis pour la stérilisation…" />
        </div>
      </div>
    </AppModal>
  );
}

export function PostponeTouchModal({ target, onClose }: { target: { plan: FollowUpPlan; touch: FollowUpTouch; mode: "report" | "skip" } | null; onClose: () => void }) {
  const { run, today } = useDemo();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (target) {
      setDate(addDays(today, 2));
      setReason("");
    }
  }, [target, today]);
  if (!target) return null;
  const skip = target.mode === "skip";
  const save = () => {
    const r = skip ? run(skipTouch, { planId: target.plan.id, touchId: target.touch.id, reason }) : run(postponeTouch, { planId: target.plan.id, touchId: target.touch.id, newDate: date, reason });
    if (r.ok) onClose();
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="sm"
      title={skip ? "Sauter cette relance" : "Reporter la relance"}
      description={`${target.touch.stage} · ${target.plan.label}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={skip ? !reason.trim() : !date}>{skip ? "Sauter" : "Reporter"}</Button>
        </>
      }
    >
      <FormGrid cols={1}>
        {!skip && (
          <div>
            <TextField label="Nouvelle date" type="date" value={date} onChange={setDate} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[1, 2, 3, 7].map((d) => (
                <button key={d} type="button" onClick={() => setDate(addDays(today, d))} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
                  +{d} j
                </button>
              ))}
            </div>
          </div>
        )}
        <TextAreaField label="Motif" required={skip} value={reason} onChange={setReason} rows={2} placeholder={skip ? "Ex. : client vu en consultation entre-temps" : "Ex. : client en voyage jusqu'à lundi"} />
      </FormGrid>
    </AppModal>
  );
}

export function StopPlanModal({ plan, onClose }: { plan: FollowUpPlan | null; onClose: () => void }) {
  const { run } = useDemo();
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [plan]);
  if (!plan) return null;
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="sm"
      title="Arrêter ce suivi"
      description={plan.label}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" variant="danger" onClick={() => run(stopPlan, { planId: plan.id, reason }).ok && onClose()} disabled={!reason.trim()}>Arrêter le suivi</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {["Animal décédé", "Client ne souhaite plus être relancé", "Client parti / déménagé", "Numéro invalide"].map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-gray-200 px-2.5 py-1 text-theme-xs text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400">
              {r}
            </button>
          ))}
        </div>
        <TextAreaField label="Motif" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}

export function StartPlanModal({ isOpen, onClose, clientId: presetClient }: { isOpen: boolean; onClose: () => void; clientId?: string }) {
  const { db, run } = useDemo();
  const opts = useOptions();
  const [clientId, setClientId] = useState("");
  const [target, setTarget] = useState("");
  const [motif, setMotif] = useState("");
  const [start, setStart] = useState("");
  const { today } = useDemo();
  useEffect(() => {
    if (isOpen) {
      setClientId(presetClient ?? "");
      setTarget("");
      setMotif("");
      setStart(today);
    }
  }, [isOpen, presetClient, today]);
  const farms = db.farms.filter((f) => f.clientId === clientId).map((f) => ({ value: `farm:${f.id}`, label: `Exploitation · ${f.name}` }));
  const pets = opts.patientsOf(clientId).map((p) => ({ value: `pat:${p.value}`, label: `Animal · ${p.label}` }));
  const save = () => {
    const [kind, id] = target.split(":");
    const name = kind === "farm" ? db.farms.find((f) => f.id === id)?.name : kind === "pat" ? db.patients.find((p) => p.id === id)?.name : db.clients.find((c) => c.id === clientId)?.name;
    const r = run(startFollowUp, { clientId, patientId: kind === "pat" ? id : undefined, farmId: kind === "farm" ? id : undefined, source: "manuel", label: `${motif.trim() || "Suivi"} — ${name ?? ""}`, motif: motif.trim() || "Suivi", startDate: start });
    if (r.ok) onClose();
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Démarrer un suivi"
      description="Les relances J0, J3, J7, J14, J30, J60 et J120 sont programmées à partir de la date choisie, puis toutes les quelques mois."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!clientId || !motif.trim()}>Démarrer</Button>
        </>
      }
    >
      <FormGrid>
        <SelectField label="Client" required value={clientId} onChange={(x) => { setClientId(x); setTarget(""); }} options={opts.clients} className="sm:col-span-2" />
        <SelectField label="Animal ou exploitation" value={target} onChange={setTarget} options={[...pets, ...farms]} allowEmpty placeholder="Le client en général" disabled={!clientId} />
        <TextField label="Date de départ (J0)" type="date" value={start} onChange={setStart} />
        <TextField label="Motif" required value={motif} onChange={setMotif} placeholder="Ex. : vente d'aliment, conseil téléphonique, chirurgie…" className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}

/* ---------------- Prospects ---------------- */

const SOURCES = [
  { value: "appel", label: "Appel reçu" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "recommandation", label: "Recommandation" },
  { value: "reseaux", label: "Réseaux sociaux" },
  { value: "passage", label: "Passage à la clinique" },
  { value: "terrain", label: "Terrain / marché" },
];
export const sourceLabel = (s: string) => SOURCES.find((x) => x.value === s)?.label ?? s;
const ACTIVITIES = [
  { value: "compagnie", label: "Animaux de compagnie" },
  { value: "rente", label: "Animaux de rente" },
  { value: "mixte", label: "Les deux" },
];

export function ProspectModal({ isOpen, onClose, prospect }: { isOpen: boolean; onClose: () => void; prospect?: Prospect }) {
  const { run, today } = useDemo();
  const empty: ProspectInput = { name: "", phone: "", location: "", source: "appel", activity: "compagnie", animals: "", need: "", difficulties: "", nextAction: "", nextActionDate: today, estimatedValue: 0 };
  const [v, setV] = useState<ProspectInput>(empty);
  useEffect(() => {
    if (isOpen) setV(prospect ? { name: prospect.name, phone: prospect.phone, location: prospect.location, source: prospect.source, activity: prospect.activity, animals: prospect.animals, need: prospect.need, difficulties: prospect.difficulties, nextAction: prospect.nextAction, nextActionDate: prospect.nextActionDate, estimatedValue: prospect.estimatedValue } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prospect]);
  const set = <K extends keyof ProspectInput>(k: K, x: ProspectInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = () => (prospect ? run(updateProspect, { id: prospect.id, patch: v }) : run(createProspect, v)).ok && onClose();
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={prospect ? `Prospect ${prospect.code}` : "Nouveau prospect"}
      description="Appel, message ou visite d'une personne qui n'est pas encore cliente."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim() || !v.phone.trim()}>Enregistrer</Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Nom" required value={v.name} onChange={(x) => set("name", x)} />
        <TextField label="Téléphone" required value={v.phone} onChange={(x) => set("phone", x)} placeholder="07 00 00 00 00" />
        <SelectField label="Comment nous a-t-il connus ?" value={v.source} onChange={(x) => set("source", x as ProspectInput["source"])} options={SOURCES} />
        <SelectField label="Activité" value={v.activity} onChange={(x) => set("activity", x as ProspectInput["activity"])} options={ACTIVITIES} />
        <TextField label="Animaux ou élevage" value={v.animals} onChange={(x) => set("animals", x)} placeholder="Ex. : 2 chiens ; 500 pondeuses" />
        <TextField label="Localisation" value={v.location} onChange={(x) => set("location", x)} placeholder="Commune, quartier" />
        <TextAreaField label="Besoin" value={v.need} onChange={(x) => set("need", x)} rows={2} className="sm:col-span-2" />
        <TextAreaField label="Difficultés rencontrées" value={v.difficulties} onChange={(x) => set("difficulties", x)} rows={2} className="sm:col-span-2" />
        <TextField label="Prochaine action" value={v.nextAction} onChange={(x) => set("nextAction", x)} placeholder="Ex. : rappeler pour fixer la visite" />
        <TextField label="Pour le" type="date" value={v.nextActionDate ?? ""} onChange={(x) => set("nextActionDate", x || undefined)} />
        <NumberField label="Valeur estimée" value={v.estimatedValue} onChange={(x) => set("estimatedValue", x)} min={0} step={5000} suffix="F CFA" />
      </FormGrid>
    </AppModal>
  );
}

export function ProspectContactModal({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const { db, run, today, user } = useDemo();
  const [channel, setChannel] = useState<Interaction["channel"]>("appel");
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (!prospect) return;
    const stage = prospect.stage === "nouveau" ? "contact" : prospect.stage === "proposition" ? "proposition" : "relance";
    const tpl = templateFor(db, "prospect", stage);
    setText(tpl ? fillTemplate(tpl.body, { client: prospect.name, motif: prospect.need || "votre besoin", clinique: db.settings.clinicName || "Cliva", veterinaire: user?.name ?? "" }) : "");
    setChannel("appel");
    setNote("");
    setNext(prospect.nextAction);
    setNextDate(addDays(today, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect]);
  if (!prospect) return null;
  const link = waLink("+225", prospect.phone, text);
  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={`Contacter ${prospect.name}`}
      description={`${prospect.phone} · ${prospect.need || "besoin à préciser"}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => run(logProspectContact, { id: prospect.id, channel, note, nextAction: next, nextActionDate: nextDate }).ok && onClose()} disabled={!note.trim()}>Enregistrer l&apos;échange</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ChannelPicker value={channel} onChange={setChannel} />
        {channel !== "appel" && channel !== "visite" && (
          <>
            <TextAreaField label="Message (modifiable)" value={text} onChange={setText} rows={3} />
            <div className="flex flex-wrap gap-2">
              {channel === "whatsapp" && link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg bg-success-600 px-3 py-2 text-sm font-medium text-white hover:bg-success-700">
                  Ouvrir WhatsApp avec ce message
                </a>
              )}
              <CopyButton text={text} label="Copier le message" />
            </div>
          </>
        )}
        <TextAreaField label="Ce qui s'est dit" required value={note} onChange={setNote} rows={3} placeholder="Besoins, difficultés, objections, budget…" />
        <FormGrid>
          <TextField label="Prochaine action" value={next} onChange={setNext} />
          <TextField label="Pour le" type="date" value={nextDate} onChange={setNextDate} />
        </FormGrid>
      </div>
    </AppModal>
  );
}

export function ProspectLostModal({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const { run } = useDemo();
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [prospect]);
  if (!prospect) return null;
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="sm"
      title="Prospect perdu"
      description={prospect.name}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" variant="danger" onClick={() => run(moveProspect, { id: prospect.id, stage: "perdu", lostReason: reason }).ok && onClose()} disabled={!reason.trim()}>Classer perdu</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {["Prix trop élevé", "A choisi un autre vétérinaire", "Trop loin", "Plus de besoin", "Injoignable"].map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-gray-200 px-2.5 py-1 text-theme-xs text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400">
              {r}
            </button>
          ))}
        </div>
        <TextAreaField label="Raison" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}

export function useConvertProspect() {
  const { run } = useDemo();
  return (p: Prospect) => run(convertProspect, { id: p.id });
}

export const fmtDue = (date: string, today: string) => {
  if (date === today) return "Aujourd'hui";
  const d = Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000);
  if (d === 1) return "Demain";
  if (d === -1) return "Hier";
  if (d < 0) return `Retard ${-d} j`;
  return formatDate(date);
};
