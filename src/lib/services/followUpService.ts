/**
 * Suivi client : parcours de relance (J0 → J120 → périodique) et entonnoir des prospects.
 * Chaque contact (message, appel, visite) est consigné dans l'historique du client.
 */
import { buildTouches, contextForSpecies, ensureNextPeriodic, OUTCOME_LABELS, settingsOf } from "../followup";
import { addDays, uid } from "../format";
import type { ActionCtx, Client, DemoDB, FollowUpContext, FollowUpPlan, FollowUpSettings, FollowUpSource, Interaction, MessageTemplate, Prospect, ProspectStage, TouchOutcome } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

const day = (ctx: ActionCtx) => ctx.now.slice(0, 10);

export interface StartPlanInput {
  clientId: string;
  patientId?: string;
  farmId?: string;
  context?: FollowUpContext;
  source: FollowUpSource;
  sourceId?: string;
  label: string;
  motif: string;
  startDate?: string;
  ownerId?: string;
}

/**
 * Crée un parcours dans un brouillon de base (utilisable depuis d'autres services).
 * Un seul parcours actif par animal ou exploitation : l'ancien est clôturé et remplacé.
 */
export function startPlanInDraft(d: DemoDB, ctx: ActionCtx, input: StartPlanInput): FollowUpPlan {
  if (!d.followUps) d.followUps = [];
  const s = settingsOf(d);
  const patient = input.patientId ? d.patients.find((p) => p.id === input.patientId) : undefined;
  const context = input.context ?? (input.farmId ? "rente" : contextForSpecies(patient?.species));
  for (const p of d.followUps) {
    if (p.status !== "actif" || p.clientId !== input.clientId) continue;
    const same = (input.patientId && p.patientId === input.patientId) || (input.farmId && p.farmId === input.farmId) || (!input.patientId && !input.farmId && !p.patientId && !p.farmId);
    if (same) {
      p.status = "termine";
      p.stopReason = `Remplacé par un nouveau suivi (${input.label})`;
      p.touches.forEach((t) => {
        if (t.status === "a_faire") t.status = "ignore";
      });
    }
  }
  const id = uid("fup");
  const start = input.startDate ?? day(ctx);
  const plan: FollowUpPlan = {
    id,
    clientId: input.clientId,
    patientId: input.patientId,
    farmId: input.farmId,
    context,
    source: input.source,
    sourceId: input.sourceId,
    label: input.label,
    motif: input.motif,
    startDate: start,
    ownerId: input.ownerId ?? ctx.user.id,
    establishmentId: ctx.establishmentId,
    status: "actif",
    touches: buildTouches(id, start, s),
  };
  d.followUps.unshift(plan);
  return plan;
}

export const startFollowUp: Service<StartPlanInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    must(d.clients.find((c) => c.id === input.clientId), "Client introuvable.");
    if (!input.label.trim()) fail("Donnez un intitulé au suivi.");
    const plan = startPlanInDraft(d, ctx, input);
    audit(d, ctx, { module: "Relation client", action: "Démarrage d'un suivi", target: plan.label });
    return { message: "Suivi démarré : les relances J0 à J120 sont programmées.", data: plan.id };
  });

function getTouch(d: DemoDB, planId: string, touchId: string) {
  const plan = must(d.followUps.find((p) => p.id === planId), "Suivi introuvable.");
  const touch = must(plan.touches.find((t) => t.id === touchId), "Relance introuvable.");
  return { plan, touch };
}

function logContact(d: DemoDB, ctx: ActionCtx, clientId: string, channel: Interaction["channel"], summary: string, touchId?: string) {
  d.interactions.unshift({ id: uid("int"), clientId, touchId, date: ctx.now, channel, summary, userId: ctx.user.id, simulated: false });
  const c = d.clients.find((x) => x.id === clientId);
  if (c) c.lastActivityAt = day(ctx);
}

export interface CompleteTouchInput {
  planId: string;
  touchId: string;
  channel: Interaction["channel"];
  outcome: TouchOutcome;
  note: string;
}

/** Consigne le contact de relance : historique client, tâche si besoin, prochaine relance. */
export const completeTouch: Service<CompleteTouchInput> = (db, ctx, input) =>
  produce(db, (d) => {
    const { plan, touch } = getTouch(d, input.planId, input.touchId);
    if (touch.status !== "a_faire") fail("Cette relance est déjà traitée.");
    if ((input.outcome === "a_revoir" || input.outcome === "besoin") && !input.note.trim()) fail("Décrivez le problème ou le besoin exprimé.");
    const label = `Relance ${touch.stage === "periodique" ? "périodique" : touch.stage} (${touch.label}) — ${plan.label}`;
    touch.attempts += 1;
    logContact(d, ctx, plan.clientId, input.channel, `${label} : ${OUTCOME_LABELS[input.outcome]}${input.note.trim() ? ` — ${input.note.trim()}` : ""}`, touch.id);
    let message = "Contact enregistré dans l'historique du client.";
    if (input.outcome === "injoignable" && touch.attempts < 3) {
      touch.dueDate = addDays(day(ctx), 2);
      touch.note = input.note || undefined;
      message = `Client injoignable : nouvelle tentative programmée le ${touch.dueDate.split("-").reverse().join("/")} (essai ${touch.attempts}/3).`;
    } else {
      touch.status = "fait";
      touch.doneAt = ctx.now;
      touch.doneById = ctx.user.id;
      touch.channel = input.channel;
      touch.outcome = input.outcome;
      touch.note = input.note.trim() || undefined;
      if (input.outcome === "a_revoir" || input.outcome === "besoin") {
        d.tasks.unshift({
          id: uid("tsk"),
          title: `${input.outcome === "a_revoir" ? "À revoir" : "Besoin client"} — ${plan.label}`,
          description: input.note.trim(),
          assigneeId: plan.ownerId,
          priority: input.outcome === "a_revoir" ? "haute" : "normale",
          dueDate: addDays(day(ctx), 1),
          status: "a_faire",
          category: "suivi_client",
          clientId: plan.clientId,
          patientId: plan.patientId,
          result: "",
          history: [{ date: ctx.now, userId: ctx.user.id, action: `Créée depuis la relance ${touch.stage}` }],
        });
        message = "Contact enregistré et tâche créée pour donner suite.";
      }
      ensureNextPeriodic(plan, settingsOf(d));
    }
    return { message };
  });

export const postponeTouch: Service<{ planId: string; touchId: string; newDate: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const { touch } = getTouch(d, input.planId, input.touchId);
    if (!input.newDate) fail("Choisissez une nouvelle date.");
    if (input.newDate < day(ctx)) fail("La nouvelle date ne peut pas être dans le passé.");
    touch.note = input.reason.trim() ? `Reportée : ${input.reason.trim()}` : touch.note;
    touch.dueDate = input.newDate;
    return { message: "Relance reportée." };
  });

export const skipTouch: Service<{ planId: string; touchId: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const { plan, touch } = getTouch(d, input.planId, input.touchId);
    if (!input.reason.trim()) fail("Indiquez pourquoi cette relance est sautée.");
    touch.status = "ignore";
    touch.note = input.reason.trim();
    touch.doneAt = ctx.now;
    touch.doneById = ctx.user.id;
    ensureNextPeriodic(plan, settingsOf(d));
    return { message: "Relance sautée." };
  });

export const stopPlan: Service<{ planId: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const plan = must(d.followUps.find((p) => p.id === input.planId), "Suivi introuvable.");
    if (!input.reason.trim()) fail("Indiquez le motif de l'arrêt du suivi.");
    plan.status = "arrete";
    plan.stopReason = input.reason.trim();
    plan.touches.forEach((t) => {
      if (t.status === "a_faire") t.status = "ignore";
    });
    audit(d, ctx, { module: "Relation client", action: "Arrêt d'un suivi", target: plan.label, reason: input.reason });
    return { message: "Suivi arrêté." };
  });

/** Contact libre (appel reçu, message envoyé, visite) consigné dans l'historique du client. */
export const recordContact: Service<{ clientId: string; channel: Interaction["channel"]; summary: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    must(d.clients.find((c) => c.id === input.clientId), "Client introuvable.");
    if (!input.summary.trim()) fail("Résumez l'échange.");
    logContact(d, ctx, input.clientId, input.channel, input.summary.trim());
    return { message: "Contact consigné dans l'historique du client." };
  });

/* ---------------- Réglages et modèles ---------------- */

export const updateFollowUpSettings: Service<FollowUpSettings> = (db, ctx, input) =>
  produce(db, (d) => {
    if (input.recurringDays < 60 || input.recurringDays > 365) fail("L'intervalle périodique doit être compris entre 60 et 365 jours.");
    const days = input.steps.map((s) => s.day);
    if (days.some((x) => !Number.isFinite(x) || x < 0)) fail("Chaque étape doit avoir un jour positif.");
    if (new Set(days).size !== days.length) fail("Deux étapes ne peuvent pas tomber le même jour.");
    d.settings.followUp = { ...input, steps: [...input.steps].sort((a, b) => a.day - b.day) };
    audit(d, ctx, { module: "Relation client", action: "Cadence de relance modifiée", target: input.steps.map((s) => s.stage).join(", ") });
    return { message: "Cadence enregistrée. Elle s'applique aux nouveaux suivis." };
  });

export const saveTemplate: Service<Omit<MessageTemplate, "id"> & { id?: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Nom du modèle requis.");
    if (!input.body.trim()) fail("Le message est vide.");
    if (input.id) {
      const t = must(d.templates.find((x) => x.id === input.id), "Modèle introuvable.");
      Object.assign(t, { ...input, name: input.name.trim(), body: input.body.trim() });
      return { message: "Modèle enregistré.", data: t.id };
    }
    const id = uid("tpl");
    d.templates.push({ ...input, id, name: input.name.trim(), body: input.body.trim() });
    audit(d, ctx, { module: "Relation client", action: "Nouveau modèle de message", target: input.name });
    return { message: "Modèle créé.", data: id };
  });

export const deleteTemplate: Service<{ id: string }> = (db, _ctx, { id }) =>
  produce(db, (d) => {
    const t = must(d.templates.find((x) => x.id === id), "Modèle introuvable.");
    if (t.id.startsWith("fu-")) fail("Les modèles de relance par défaut peuvent être modifiés mais pas supprimés.");
    d.templates = d.templates.filter((x) => x.id !== id);
    return { message: "Modèle supprimé." };
  });

/* ---------------- Prospects ---------------- */

export type ProspectInput = Pick<Prospect, "name" | "phone" | "location" | "source" | "activity" | "animals" | "need" | "difficulties" | "nextAction" | "nextActionDate" | "estimatedValue">;

export const PROSPECT_STAGES: { key: ProspectStage; label: string; hint: string }[] = [
  { key: "nouveau", label: "Nouveau contact", hint: "Appel ou message reçu, à rappeler" },
  { key: "contacte", label: "Contacté", hint: "Premier échange fait" },
  { key: "besoin_identifie", label: "Besoin identifié", hint: "Difficultés et besoins compris" },
  { key: "proposition", label: "Proposition", hint: "Devis, rendez-vous ou visite proposés" },
  { key: "gagne", label: "Client", hint: "Devenu client" },
  { key: "perdu", label: "Perdu", hint: "Sans suite" },
];
const stageLabel = (s: ProspectStage) => PROSPECT_STAGES.find((x) => x.key === s)?.label ?? s;

function validateProspect(p: ProspectInput) {
  if (!p.name.trim()) fail("Nom du prospect requis.");
  if (!p.phone.trim()) fail("Téléphone requis pour pouvoir le suivre.");
}

export const createProspect: Service<ProspectInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    validateProspect(input);
    if (!d.prospects) d.prospects = [];
    const id = uid("prs");
    d.prospects.unshift({
      ...input,
      id,
      code: nextCode(d, "prospect", "PRS"),
      stage: "nouveau",
      ownerId: ctx.user.id,
      establishmentId: ctx.establishmentId,
      createdAt: day(ctx),
      updatedAt: day(ctx),
      nextActionDate: input.nextActionDate || day(ctx),
      nextAction: input.nextAction || "Rappeler pour comprendre le besoin",
      history: [{ date: ctx.now, userId: ctx.user.id, action: "Prospect enregistré", note: input.need }],
    });
    return { message: "Prospect ajouté à l'entonnoir.", data: id };
  });

export const updateProspect: Service<{ id: string; patch: Partial<ProspectInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const p = must(d.prospects.find((x) => x.id === id), "Prospect introuvable.");
    Object.assign(p, patch);
    validateProspect(p);
    p.updatedAt = day(ctx);
    p.history.unshift({ date: ctx.now, userId: ctx.user.id, action: "Fiche mise à jour" });
    return { message: "Prospect mis à jour." };
  });

export const moveProspect: Service<{ id: string; stage: ProspectStage; note?: string; lostReason?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.prospects.find((x) => x.id === input.id), "Prospect introuvable.");
    if (input.stage === "gagne") fail("Utilisez « Convertir en client » pour créer la fiche client.");
    if (input.stage === "perdu" && !input.lostReason?.trim()) fail("Indiquez pourquoi le prospect est perdu.");
    const from = p.stage;
    p.stage = input.stage;
    p.lostReason = input.stage === "perdu" ? input.lostReason?.trim() : undefined;
    p.updatedAt = day(ctx);
    p.history.unshift({ date: ctx.now, userId: ctx.user.id, action: `${stageLabel(from)} → ${stageLabel(input.stage)}`, note: input.lostReason || input.note });
    return { message: `Prospect déplacé : ${stageLabel(input.stage)}.` };
  });

/** Contact avec un prospect (appel, message…) + prochaine action. */
export const logProspectContact: Service<{ id: string; channel: Interaction["channel"]; note: string; nextAction: string; nextActionDate?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.prospects.find((x) => x.id === input.id), "Prospect introuvable.");
    if (!input.note.trim()) fail("Résumez l'échange avec le prospect.");
    p.history.unshift({ date: ctx.now, userId: ctx.user.id, action: "Contact", channel: input.channel, note: input.note.trim() });
    if (p.stage === "nouveau") p.stage = "contacte";
    p.nextAction = input.nextAction.trim();
    p.nextActionDate = input.nextActionDate || undefined;
    p.updatedAt = day(ctx);
    return { message: "Échange consigné." };
  });

/** Crée la fiche client et démarre son parcours de suivi. */
export const convertProspect: Service<{ id: string }, string> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const p = must(d.prospects.find((x) => x.id === id), "Prospect introuvable.");
    if (p.convertedClientId) fail("Ce prospect est déjà client.");
    const clientId = uid("cli");
    const code = nextCode(d, "client", "CLI");
    const client: Client = {
      id: clientId,
      code,
      type: "particulier",
      name: p.name,
      phoneCode: "+225",
      phone: p.phone,
      email: "",
      address: p.location,
      city: p.location,
      contacts: [],
      commPrefs: { sms: true, whatsapp: true, email: false, call: true },
      segment: p.activity === "rente" ? "eleveur" : "standard",
      payerName: "",
      payerTaxId: "",
      notes: [{ id: uid("note"), date: ctx.now, authorId: ctx.user.id, text: `Ancien prospect ${p.code}. Besoin : ${p.need}${p.difficulties ? ` · Difficultés : ${p.difficulties}` : ""}` } as Client["notes"][number]],
      status: "actif",
      establishmentId: p.establishmentId,
      createdAt: day(ctx),
      lastActivityAt: day(ctx),
    };
    d.clients.unshift(client);
    p.stage = "gagne";
    p.convertedClientId = clientId;
    p.updatedAt = day(ctx);
    p.history.unshift({ date: ctx.now, userId: ctx.user.id, action: `Converti en client ${code}` });
    startPlanInDraft(d, ctx, { clientId, context: p.activity === "rente" ? "rente" : "compagnie", source: "prospect", sourceId: p.id, label: `Nouveau client ${p.name}`, motif: p.need });
    audit(d, ctx, { module: "Relation client", action: "Prospect converti", target: `${p.code} → ${code}` });
    return { message: `${p.name} est maintenant client (${code}) ; son suivi est programmé.`, data: clientId };
  });
