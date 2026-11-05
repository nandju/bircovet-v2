/**
 * Suivi client : cadence de relances, modèles de messages et construction des parcours.
 * J0 visite/action → J3 évolution du traitement → J7, J14, J30 nouvelles →
 * J60, J120 salutations, difficultés et besoins → puis toutes les 4 à 6 mois.
 */
import { addDays } from "./format";
import type { DemoDB, FollowUpContext, FollowUpPlan, FollowUpSettings, FollowUpTouch, MessageTemplate, Prospect } from "./types";

export const RENTE_SPECIES = ["Bovin", "Ovin", "Caprin", "Porcin", "Volaille", "Lapin", "Équidé"];

export const DEFAULT_FOLLOWUP: FollowUpSettings = {
  steps: [
    { day: 0, stage: "J0", label: "Visite ou action" },
    { day: 3, stage: "J3", label: "Évolution du traitement" },
    { day: 7, stage: "J7", label: "Prise de nouvelles" },
    { day: 14, stage: "J14", label: "Prise de nouvelles" },
    { day: 30, stage: "J30", label: "Nouvelles et bilan" },
    { day: 60, stage: "J60", label: "Salutations, difficultés, besoins" },
    { day: 120, stage: "J120", label: "Salutations, difficultés, besoins" },
  ],
  recurringDays: 150,
  autoStart: { consultation: true, hospitalisation: true, mission: true },
};

export const PERIODIC_STAGE = "periodique";
export const PERIODIC_LABEL = "Prise de nouvelles périodique";

const T = (context: FollowUpContext | "prospect", stage: string, name: string, body: string): MessageTemplate => ({
  id: `fu-${context}-${stage}`,
  name,
  channel: "whatsapp",
  stage,
  context,
  body,
});

/** Modèles prédéfinis, modifiables dans Relation client → Suivi client → Modèles. */
export const FOLLOWUP_TEMPLATES: MessageTemplate[] = [
  T("compagnie", "J0", "Compagnie · J0 merci et consignes", "Bonjour {client}, merci pour votre confiance aujourd'hui pour {patient}. Suivez bien le traitement prescrit ; pour toute question, nous restons joignables. — {clinique}"),
  T("compagnie", "J3", "Compagnie · J3 évolution du traitement", "Bonjour {client}, comment évolue {patient} depuis le début du traitement ? Mange-t-il bien, le traitement se passe-t-il sans difficulté ? Répondez-nous simplement ici. — {clinique}"),
  T("compagnie", "J7", "Compagnie · J7 nouvelles", "Bonjour {client}, une semaine déjà ! Comment va {patient} ? S'il reste un souci, nous pouvons vous proposer un contrôle. — {clinique}"),
  T("compagnie", "J14", "Compagnie · J14 nouvelles", "Bonjour {client}, nous prenons des nouvelles de {patient}. Tout se passe bien ? Écrivez-nous au moindre doute. — {clinique}"),
  T("compagnie", "J30", "Compagnie · J30 nouvelles et bilan", "Bonjour {client}, un mois après la visite de {patient}, comment va-t-il ? C'est aussi le bon moment pour vérifier vaccins et déparasitage. — {clinique}"),
  T("compagnie", "J60", "Compagnie · J60 salutations et besoins", "Bonjour {client}, toute l'équipe {clinique} vous salue ! Comment se portent {patient} et la famille ? Avez-vous une difficulté ou un besoin particulier (alimentation, antiparasitaires, toilettage…) ? Nous sommes là."),
  T("compagnie", "J120", "Compagnie · J120 salutations et besoins", "Bonjour {client}, cela fait quelques mois ! Comment va {patient} ? Un bilan de santé ou un rappel est peut-être à prévoir. Dites-nous si vous avez un besoin. — {clinique}"),
  T("compagnie", PERIODIC_STAGE, "Compagnie · nouvelles périodiques", "Bonjour {client}, l'équipe {clinique} prend des nouvelles de {patient}. Tout va bien ? Pensez au bilan annuel, aux vaccins et au déparasitage. Nous restons à votre écoute."),
  T("rente", "J0", "Rente · J0 merci et recommandations", "Bonjour {client}, merci pour votre accueil à {exploitation} aujourd'hui. Appliquez bien les mesures convenues ; le compte rendu suit. Nous restons joignables. — {clinique}"),
  T("rente", "J3", "Rente · J3 évolution du traitement", "Bonjour {client}, comment évolue la situation à {exploitation} depuis notre passage ? Mortalité, eau, aliment, traitement : tout se passe bien ? — {clinique}"),
  T("rente", "J7", "Rente · J7 nouvelles de l'élevage", "Bonjour {client}, une semaine après notre intervention, quelles nouvelles de l'élevage ? Si des signes persistent, nous pouvons repasser. — {clinique}"),
  T("rente", "J14", "Rente · J14 performances", "Bonjour {client}, nous prenons des nouvelles de {exploitation}. Les performances reviennent-elles à la normale ? — {clinique}"),
  T("rente", "J30", "Rente · J30 point mensuel", "Bonjour {client}, un mois après notre visite, faisons le point : résultats, prochaines vaccinations, besoins en produits ou en aliment ? — {clinique}"),
  T("rente", "J60", "Rente · J60 salutations et besoins", "Bonjour {client}, l'équipe {clinique} vous salue ! Comment se porte {exploitation} ? Avez-vous une difficulté (sanitaire, aliment, main-d'œuvre) ou un projet de nouvelle bande ? Nous pouvons vous accompagner."),
  T("rente", "J120", "Rente · J120 programme sanitaire", "Bonjour {client}, quelques mois après notre dernier passage, comment va l'élevage ? Planifions si besoin une visite de suivi ou le programme sanitaire de la prochaine bande. — {clinique}"),
  T("rente", PERIODIC_STAGE, "Rente · nouvelles périodiques", "Bonjour {client}, l'équipe {clinique} prend des nouvelles de {exploitation}. Une visite de routine ou un conseil vous serait utile ? Nous restons disponibles."),
  T("prospect", "contact", "Prospect · premier contact", "Bonjour {client}, merci pour votre appel à {clinique}. Comme convenu, voici nos coordonnées. Quand pouvons-nous vous recevoir ou passer vous voir ?"),
  T("prospect", "relance", "Prospect · relance", "Bonjour {client}, nous revenons vers vous suite à notre échange au sujet de : {motif}. Pouvons-nous vous proposer un rendez-vous cette semaine ?"),
  T("prospect", "proposition", "Prospect · proposition", "Bonjour {client}, voici notre proposition pour : {motif}. Posez-nous toutes vos questions, nous sommes là pour vous accompagner."),
];

export const OUTCOME_LABELS: Record<NonNullable<FollowUpTouch["outcome"]>, string> = {
  rassure: "Tout va bien",
  a_revoir: "Problème : à revoir",
  besoin: "Besoin exprimé",
  rdv_pris: "Rendez-vous pris",
  injoignable: "Injoignable",
};

export function settingsOf(db: DemoDB): FollowUpSettings {
  return db.settings.followUp ?? DEFAULT_FOLLOWUP;
}

export function contextForSpecies(species?: string): FollowUpContext {
  return species && RENTE_SPECIES.includes(species) ? "rente" : "compagnie";
}

let seq = 0;
const tid = (planId: string) => `${planId}-t${++seq}`;

export function buildTouches(planId: string, startDate: string, s: FollowUpSettings): FollowUpTouch[] {
  return s.steps.map((st) => ({ id: tid(planId), stage: st.stage, label: st.label, day: st.day, dueDate: addDays(startDate, st.day), status: "a_faire" as const, attempts: 0 }));
}

/** Ajoute la prochaine prise de nouvelles périodique quand toutes les étapes sont traitées. */
export function ensureNextPeriodic(plan: FollowUpPlan, s: FollowUpSettings) {
  if (plan.status !== "actif") return;
  if (plan.touches.some((t) => t.status === "a_faire")) return;
  const last = plan.touches[plan.touches.length - 1];
  const base = last ? (last.doneAt?.slice(0, 10) ?? last.dueDate) : plan.startDate;
  const day = (last?.day ?? 0) + s.recurringDays;
  plan.touches.push({ id: tid(plan.id), stage: PERIODIC_STAGE, label: PERIODIC_LABEL, day, dueDate: addDays(base, s.recurringDays), status: "a_faire", attempts: 0 });
}

export function templateFor(db: DemoDB, context: FollowUpContext | "prospect", stage: string): MessageTemplate | undefined {
  return db.templates.find((t) => t.context === context && t.stage === stage) ?? db.templates.find((t) => t.context === context && t.stage === PERIODIC_STAGE);
}

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function planVars(db: DemoDB, plan: FollowUpPlan, vetName?: string): Record<string, string> {
  const client = db.clients.find((c) => c.id === plan.clientId);
  const patient = plan.patientId ? db.patients.find((p) => p.id === plan.patientId) : undefined;
  const farm = plan.farmId ? db.farms.find((f) => f.id === plan.farmId) : undefined;
  return {
    client: client?.name.split(" ").slice(0, 2).join(" ") ?? "",
    patient: patient?.name ?? (farm ? "vos animaux" : "votre animal"),
    exploitation: farm?.name ?? "votre exploitation",
    motif: plan.motif,
    clinique: db.settings.clinicName || "Cliva",
    veterinaire: vetName ?? "",
  };
}

/** Numéro au format international pour un lien WhatsApp (Côte d'Ivoire par défaut). */
export function waNumber(phoneCode: string | undefined, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const code = (phoneCode || "+225").replace(/\D/g, "");
  return digits.startsWith(code) && digits.length > 10 ? digits : code + digits;
}

/* ---------------- Données de démonstration et migration ---------------- */

/** Parcours de démo construits à partir des consultations et missions existantes. */
export function seedFollowUps(db: DemoDB, today: string): FollowUpPlan[] {
  const s = settingsOf(db);
  const plans: FollowUpPlan[] = [];
  const seenPatient = new Set<string>();
  const cons = [...db.consultations].filter((c) => c.date.slice(0, 10) <= today && c.date.slice(0, 10) >= addDays(today, -200)).sort((a, b) => b.date.localeCompare(a.date));
  let n = 0;
  for (const c of cons) {
    if (seenPatient.has(c.patientId)) continue;
    seenPatient.add(c.patientId);
    const patient = db.patients.find((p) => p.id === c.patientId);
    if (!patient || patient.vitalStatus !== "vivant") continue;
    const id = `fup-${c.id}`;
    const start = c.date.slice(0, 10);
    const plan: FollowUpPlan = {
      id,
      clientId: c.clientId,
      patientId: c.patientId,
      context: contextForSpecies(patient.species),
      source: "consultation",
      sourceId: c.id,
      label: `Consultation ${c.code} — ${patient.name}`,
      motif: c.reason,
      startDate: start,
      ownerId: c.vetId,
      establishmentId: c.establishmentId,
      status: "actif",
      touches: buildTouches(id, start, s),
    };
    // Les étapes passées depuis plus de 2 jours sont considérées traitées (sauf quelques-unes laissées en retard).
    plan.touches.forEach((t, i) => {
      if (t.dueDate < addDays(today, -2) && !(n % 4 === 0 && i === plan.touches.findIndex((x) => x.dueDate >= addDays(today, -6)))) {
        t.status = "fait";
        t.doneAt = `${t.dueDate}T10:00:00`;
        t.doneById = c.vetId;
        t.channel = i % 3 === 0 ? "appel" : "whatsapp";
        t.outcome = i % 5 === 3 ? "besoin" : "rassure";
        t.note = t.outcome === "besoin" ? "Demande de conseil sur l'alimentation (donnée de démo)." : "Va bien, traitement suivi (donnée de démo).";
      }
    });
    ensureNextPeriodic(plan, s);
    plans.push(plan);
    n++;
  }
  for (const m of db.missions.filter((x) => x.status === "terminee" && x.farmIds.length)) {
    const farm = db.farms.find((f) => f.id === m.farmIds[0]);
    if (!farm) continue;
    const id = `fup-${m.id}`;
    const plan: FollowUpPlan = {
      id,
      clientId: farm.clientId,
      farmId: farm.id,
      context: "rente",
      source: "mission",
      sourceId: m.id,
      label: `Mission ${m.code} — ${farm.name}`,
      motif: m.objective,
      startDate: m.date.slice(0, 10),
      ownerId: m.leaderId,
      establishmentId: m.establishmentId,
      status: "actif",
      touches: buildTouches(id, m.date.slice(0, 10), s),
    };
    plan.touches.forEach((t) => {
      if (t.dueDate < addDays(today, -2)) {
        t.status = "fait";
        t.doneAt = `${t.dueDate}T11:00:00`;
        t.doneById = m.leaderId;
        t.channel = "appel";
        t.outcome = "rassure";
        t.note = "Situation stable (donnée de démo).";
      }
    });
    ensureNextPeriodic(plan, s);
    plans.push(plan);
  }
  return plans;
}

export function seedProspects(db: DemoDB, today: string): Prospect[] {
  const owner = db.users.find((u) => u.roleId === "accueil")?.id ?? db.users[0].id;
  const vet = db.users.find((u) => u.roleId === "vet")?.id ?? owner;
  const est = db.establishments[0].id;
  const P = (i: number, p: Partial<Prospect> & Pick<Prospect, "name" | "phone" | "source" | "activity" | "animals" | "need" | "stage">): Prospect => ({
    id: `prs-${i}`,
    code: `PRS-${String(i).padStart(4, "0")}`,
    location: "Abidjan",
    difficulties: "",
    nextAction: "",
    estimatedValue: 0,
    ownerId: owner,
    establishmentId: est,
    createdAt: addDays(today, -(i * 3)),
    updatedAt: addDays(today, -i),
    history: [{ date: `${addDays(today, -(i * 3))}T09:30:00`, userId: owner, action: "Prospect enregistré", note: `Source : ${p.source}` }],
    ...p,
  });
  return [
    P(1, { name: "Mme Koffi Ange", phone: "07 11 22 33 44", source: "appel", activity: "compagnie", animals: "2 chiots Berger allemand", need: "Vaccination et identification", stage: "nouveau", nextAction: "Rappeler pour fixer le rendez-vous", nextActionDate: today, location: "Yopougon Maroc", estimatedValue: 45000 }),
    P(2, { name: "M. Yao Désiré", phone: "05 66 77 88 99", source: "whatsapp", activity: "rente", animals: "Projet poulets de chair, 1 000 sujets", need: "Accompagnement démarrage de bande", difficulties: "Première bande, pas de bâtiment adapté", stage: "contacte", nextAction: "Visite du site prévu", nextActionDate: addDays(today, 2), location: "Songon", estimatedValue: 250000, ownerId: vet }),
    P(3, { name: "Ferme Les Palmiers", phone: "01 23 45 67 89", source: "recommandation", activity: "rente", animals: "Élevage porcin, 40 truies", need: "Suivi sanitaire mensuel", difficulties: "Mortalité des porcelets au sevrage", stage: "besoin_identifie", nextAction: "Envoyer la proposition de contrat de suivi", nextActionDate: addDays(today, -1), location: "Dabou", estimatedValue: 600000, ownerId: vet }),
    P(4, { name: "Mlle Bamba Fatou", phone: "07 98 76 54 32", source: "reseaux", activity: "compagnie", animals: "Chat persan, 3 ans", need: "Stérilisation", stage: "proposition", nextAction: "Confirmer la date d'intervention", nextActionDate: addDays(today, 1), location: "Cocody", estimatedValue: 60000 }),
    P(5, { name: "M. Traoré Issa", phone: "05 44 33 22 11", source: "passage", activity: "mixte", animals: "Chiens de garde + 15 moutons", need: "Déparasitage et vaccination", stage: "contacte", nextAction: "Relancer par WhatsApp", nextActionDate: addDays(today, -3), location: "Anyama", estimatedValue: 80000 }),
    P(6, { name: "Élevage Avicole Kouamé", phone: "07 55 66 77 88", source: "terrain", activity: "rente", animals: "Pondeuses, 3 000 sujets", need: "Programme de vaccination", stage: "perdu", lostReason: "A choisi un prestataire plus proche", location: "Bingerville", estimatedValue: 300000 }),
  ];
}

/** Migration v5 → v6 : ajoute les parcours de suivi, les prospects et les modèles de relance. */
export function migrateToV6(db: DemoDB, today: string): DemoDB {
  const next: DemoDB = { ...db, schemaVersion: 6, settings: { ...db.settings, followUp: db.settings.followUp ?? DEFAULT_FOLLOWUP } };
  const existing = new Set(db.templates.map((t) => t.id));
  next.templates = [...db.templates, ...FOLLOWUP_TEMPLATES.filter((t) => !existing.has(t.id)).map((t) => ({ ...t }))];
  next.followUps = db.followUps ?? seedFollowUps(next, today);
  next.prospects = db.prospects ?? seedProspects(next, today);
  next.counters = { ...db.counters, prospect: Math.max(db.counters.prospect ?? 0, next.prospects.length) };
  return next;
}
