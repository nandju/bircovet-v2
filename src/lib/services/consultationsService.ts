import { CLINICAL_VALIDATORS, RESPONSIBLE_VET_ROLES } from "../permissions";
import { uid } from "../format";
import type { BillableAct, Consultation } from "../types";
import { audit, fail, must, nextCode, produce, requireOnline, requireRole, type Service } from "./core";

export type ConsultationInput = Omit<
  Consultation,
  "id" | "code" | "authorId" | "status" | "validatedById" | "validatedAt" | "invoiceId" | "paymentException" | "establishmentId" | "syncStatus"
> & { establishmentId?: string };

function checkVet(db: { users: { id: string; roleId: string }[] }, vetId: string) {
  const vet = must(db.users.find((u) => u.id === vetId), "Vétérinaire responsable requis.");
  if (!RESPONSIBLE_VET_ROLES.includes(vet.roleId as never)) fail("Le responsable clinique doit être un vétérinaire habilité (un assistant ne peut pas être responsable).");
}

export const createConsultation: Service<ConsultationInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.patientId || !input.clientId) fail("Client et patient requis.");
    if (!input.reason.trim()) fail("Motif requis.");
    checkVet(d, input.vetId);
    const patient = must(d.patients.find((p) => p.id === input.patientId));
    if (patient.vitalStatus === "decede") fail("Impossible d'ouvrir une consultation pour un animal décédé.");
    const id = uid("con");
    const code = nextCode(d, "consultation", "CONS");
    d.consultations.unshift({
      ...input,
      id,
      code,
      establishmentId: input.establishmentId ?? ctx.establishmentId,
      authorId: ctx.user.id,
      status: "brouillon",
      acts: input.acts.length ? input.acts : [{ id: uid("act"), label: "Consultation", qty: 1, unitPrice: 15000 }],
      syncStatus: ctx.offline ? "en_attente" : undefined,
    });
    if (input.appointmentId) {
      const a = d.appointments.find((x) => x.id === input.appointmentId);
      if (a) a.consultationId = id;
    }
    audit(d, ctx, { module: "Consultations", action: "Création (brouillon)", target: `${code} — ${patient.name}` });
    return { message: `Consultation ${code} enregistrée en brouillon.`, data: id };
  });

export const updateConsultation: Service<{ id: string; patch: Partial<ConsultationInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.status === "valide") fail("Consultation validée : modification verrouillée. Ajoutez une observation complémentaire si nécessaire.");
    if (patch.vetId) checkVet(d, patch.vetId);
    Object.assign(c, patch);
    return { message: "Brouillon enregistré." };
  });

export const submitConsultation: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.status !== "brouillon") fail("Seul un brouillon peut être soumis à validation.");
    if (!c.diagnosis.trim()) fail("Le diagnostic retenu doit être renseigné avant soumission.");
    c.status = "a_valider";
    audit(d, ctx, { module: "Consultations", action: "Soumission à validation", target: c.code });
    return { message: "Consultation soumise à la validation du vétérinaire responsable." };
  });

export const validateConsultation: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, CLINICAL_VALIDATORS, "validation clinique");
    requireOnline(ctx, "Validation clinique");
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.status === "valide") fail("Déjà validée.");
    if (!c.diagnosis.trim()) fail("Diagnostic retenu manquant.");
    if (ctx.user.roleId !== "dg" && c.vetId !== ctx.user.id) fail("Seul le vétérinaire responsable (ou le DG) peut valider ce dossier.");
    c.status = "valide";
    c.validatedById = ctx.user.id;
    c.validatedAt = ctx.now;
    audit(d, ctx, { module: "Consultations", action: "Validation clinique", target: c.code, oldValue: "En attente", newValue: "Validé", decision: `Validé par ${ctx.user.name}` });
    return { message: `Consultation validée par ${ctx.user.name}.` };
  });

export const returnToDraft: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    requireRole(ctx, CLINICAL_VALIDATORS, "renvoi en brouillon");
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.status !== "a_valider") fail("Seul un dossier en attente peut être renvoyé.");
    if (!reason.trim()) fail("Motif requis.");
    c.status = "brouillon";
    c.observations = `${c.observations}\n[Renvoyé en brouillon par ${ctx.user.name} : ${reason}]`.trim();
    audit(d, ctx, { module: "Consultations", action: "Renvoi en brouillon", target: c.code, reason });
    return { message: "Dossier renvoyé en brouillon." };
  });

export const setActs: Service<{ id: string; acts: BillableAct[] }> = (db, ctx, { id, acts }) =>
  produce(db, (d) => {
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.invoiceId) fail("Actes déjà facturés : utilisez un avoir pour corriger.");
    if (acts.some((a) => !a.label.trim() || a.qty <= 0 || a.unitPrice < 0)) fail("Ligne d'acte invalide.");
    c.acts = acts;
    return { message: "Actes facturables mis à jour." };
  });

export const markPrepaid: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.financialStatus === "facture") fail("Déjà facturée.");
    c.financialStatus = "regle_avance";
    audit(d, ctx, { module: "Consultations", action: "Paiement préalable constaté", target: c.code });
    return { message: "Paiement préalable constaté (statut financier distinct du statut clinique)." };
  });

export const requestPaymentException: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    const c = must(d.consultations.find((x) => x.id === id));
    if (!reason.trim()) fail("Motif requis.");
    if (c.financialStatus !== "non_regle") fail("Une exception ne peut être demandée que pour une consultation non réglée.");
    c.financialStatus = "exception_demandee";
    c.paymentException = { requestedById: ctx.user.id, reason, date: ctx.now };
    audit(d, ctx, { module: "Consultations", action: "Demande d'exception au paiement préalable", target: c.code, reason });
    return { message: "Exception demandée — en attente de l'approbation du DG." };
  });

export const decidePaymentException: Service<{ id: string; approve: boolean }> = (db, ctx, { id, approve }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "approbation DG");
    requireOnline(ctx, "Décision financière");
    const c = must(d.consultations.find((x) => x.id === id));
    if (c.financialStatus !== "exception_demandee" || !c.paymentException) fail("Aucune demande en attente.");
    c.paymentException.decidedById = ctx.user.id;
    c.paymentException.decision = approve ? "approuvee" : "refusee";
    c.financialStatus = approve ? "exception_approuvee" : "non_regle";
    audit(d, ctx, { module: "Consultations", action: "Décision d'exception de paiement", target: c.code, decision: approve ? "Approuvée" : "Refusée" });
    return { message: approve ? "Exception approuvée par le DG." : "Exception refusée." };
  });

/** Saisie d'un acte d'euthanasie : ne modifie PAS automatiquement le statut vital. */
export const recordEuthanasia: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "saisie d'acte");
    const c = must(d.consultations.find((x) => x.id === id));
    c.euthanasiaRecorded = true;
    audit(d, ctx, { module: "Consultations", action: "Acte d'euthanasie saisi", target: c.code, newValue: "Statut vital inchangé (déclaration de décès distincte requise)" });
    return { message: "Acte saisi. Le statut vital n'est pas modifié : utilisez « Déclarer le décès » sur la fiche patient." };
  });
