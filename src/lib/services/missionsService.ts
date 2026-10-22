import { lotBlockReason } from "../calc";
import { uid } from "../format";
import type { InvoiceLine, Mission, MissionStatus } from "../types";
import { audit, fail, must, nextCode, positive, produce, today, type Service } from "./core";
import { applyMovement } from "./inventoryService";
import { buildInvoice } from "./invoicesService";
import { queueIfOffline } from "./syncService";

export type MissionInput = Pick<
  Mission,
  "objective" | "category" | "serviceType" | "serviceLabel" | "date" | "endDate" | "location" | "leaderId" | "teamIds" | "farmIds" | "clientIds" | "plannedInterventions"
>;

export const createMission: Service<MissionInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.objective.trim()) fail("Objectif requis.");
    if (!input.date) fail("Date requise.");
    if (input.endDate < input.date) fail("La date de fin précède la date de début.");
    const id = uid("mis");
    const code = nextCode(d, "mission", "MIS");
    d.missions.unshift({ ...input, id, code, establishmentId: ctx.establishmentId, interventionsDone: [], stock: [], observedHeadcounts: [], report: "", actionItems: [], status: "brouillon" });
    audit(d, ctx, { module: "Missions", action: "Création", target: code });
    return { message: `Mission ${code} créée en brouillon.`, data: id };
  });

export const updateMission: Service<{ id: string; patch: Partial<MissionInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === id));
    if (m.status === "terminee" || m.status === "annulee") fail("Mission close.");
    Object.assign(m, patch);
    return { message: "Mission mise à jour." };
  });

const FLOW: Record<MissionStatus, MissionStatus[]> = {
  brouillon: ["planifiee", "annulee"],
  planifiee: ["en_cours", "annulee", "brouillon"],
  en_cours: ["terminee"],
  terminee: [],
  annulee: [],
};
export const missionTransitions = (s: MissionStatus) => FLOW[s];

export const addMissionAction: Service<{ id: string; label: string; assigneeId?: string; dueDate?: string }> = (db, ctx, { id, label, assigneeId, dueDate }) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === id));
    if (!label.trim()) fail("Libellé d'action requis.");
    m.actionItems.push({ id: uid("ma"), label: label.trim(), assigneeId, dueDate, done: false });
    return { message: "Action à mener ajoutée." };
  });

export const toggleMissionAction: Service<{ id: string; actionId: string; note?: string }> = (db, ctx, { id, actionId, note }) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === id));
    const a = must(m.actionItems.find((x) => x.id === actionId), "Action introuvable.");
    a.done = !a.done;
    a.note = note ?? a.note;
    return { message: a.done ? "Action marquée réalisée." : "Action rouverte." };
  });

export const setMissionStatus: Service<{ id: string; status: MissionStatus; reason?: string }> = (db, ctx, { id, status, reason }) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === id));
    if (!FLOW[m.status].includes(status)) fail("Transition non autorisée.");
    if (status === "annulee") {
      if (!reason?.trim()) fail("Motif d'annulation requis.");
      if (m.stock.some((s) => !s.reconciled)) fail("Du stock a été transféré : effectuez le rapprochement (retours) avant annulation.");
    }
    if (status === "terminee" && !m.report.trim()) fail("Le rapport de mission est requis pour terminer.");
    m.status = status;
    audit(d, ctx, { module: "Missions", action: `Statut : ${status}`, target: m.code, reason });
    return { message: "Statut de la mission mis à jour." };
  });

/** Transfert de stock vers une mission : n'est PAS une vente. */
export const transferToMission: Service<{ id: string; lotId: string; qty: number; opKey: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === input.id));
    if (!["planifiee", "en_cours"].includes(m.status)) fail("Le transfert est possible pour une mission planifiée ou en cours.");
    if (m.stock.some((s) => s.transferMovementId && d.movements.find((mv) => mv.id === s.transferMovementId)?.opKey === input.opKey)) return { message: "Transfert déjà enregistré." };
    positive(input.qty, "La quantité");
    const lot = must(d.lots.find((l) => l.id === input.lotId));
    const reason = lotBlockReason(lot, today(ctx));
    if (reason) fail(`Transfert bloqué : ${reason}`);
    const mvId = applyMovement(d, ctx, { lotId: lot.id, type: "mission_sortie", qty: -input.qty, ref: { kind: "mission", id: m.id }, note: `Transfert vers ${m.code} (non vendu)`, opKey: input.opKey });
    m.stock.push({ id: uid("ms"), productId: lot.productId, lotId: lot.id, transferred: input.qty, consumed: 0, delivered: 0, lost: 0, returned: 0, transferMovementId: mvId, reconciled: false });
    audit(d, ctx, { module: "Missions", action: "Transfert de stock vers mission", target: `${m.code} — ${lot.ref}`, newValue: String(input.qty) });
    return { message: "Stock transféré vers la mission (ce n'est pas une vente)." };
  });

export const recordMissionUsage: Service<{ id: string; lineId: string; consumed: number; delivered: number; lost: number; returned: number }> = (db, ctx, input) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === input.id));
    const l = must(m.stock.find((s) => s.id === input.lineId));
    if (l.reconciled) fail("Ligne déjà rapprochée : modification impossible.");
    const vals = [input.consumed, input.delivered, input.lost, input.returned];
    if (vals.some((v) => v < 0 || !Number.isFinite(v))) fail("Quantités invalides.");
    const sum = vals.reduce((s, v) => s + v, 0);
    if (sum > l.transferred) fail(`Total (${sum}) supérieur à la quantité transférée (${l.transferred}).`);
    Object.assign(l, { consumed: input.consumed, delivered: input.delivered, lost: input.lost, returned: input.returned });
    return { message: "Utilisation enregistrée." };
  });

/** Rapprochement : écart nul exigé ; seuls les retours ré-entrent en stock (une fois). */
export const reconcileMission: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === id));
    if (!m.stock.length) fail("Aucun stock transféré.");
    for (const l of m.stock) {
      if (l.reconciled) continue;
      const sum = l.consumed + l.delivered + l.lost + l.returned;
      if (sum !== l.transferred) fail(`Écart non justifié sur le lot ${d.lots.find((x) => x.id === l.lotId)?.ref} : ${l.transferred - sum} unité(s).`);
    }
    for (const l of m.stock) {
      if (l.reconciled) continue;
      if (l.returned > 0) applyMovement(d, ctx, { lotId: l.lotId, type: "mission_retour", qty: l.returned, ref: { kind: "mission", id: m.id }, note: `Retour ${m.code}`, opKey: `mis-ret-${l.id}` });
      if (l.lost > 0) d.movements.unshift({ id: uid("mv"), date: ctx.now, productId: l.productId, lotId: l.lotId, establishmentId: d.lots.find((x) => x.id === l.lotId)!.establishmentId, type: "perte", qty: 0, userId: ctx.user.id, ref: { kind: "mission", id: m.id }, note: `Perte déclarée en mission ${m.code} : ${l.lost} (déjà sortie au transfert — trace documentaire)`, opKey: `mis-loss-${l.id}` });
      l.reconciled = true;
    }
    m.reconciledAt = ctx.now;
    audit(d, ctx, { module: "Missions", action: "Rapprochement après mission", target: m.code });
    return { message: "Rapprochement effectué : retours réintégrés au stock, consommations et pertes tracées." };
  });

export const saveMissionReport: Service<{ id: string; report: string; interventionsDone: string[]; observed: Mission["observedHeadcounts"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === input.id));
    if (m.status === "annulee") fail("Mission annulée.");
    m.report = input.report;
    m.interventionsDone = input.interventionsDone;
    m.observedHeadcounts = input.observed;
    m.reportSyncStatus = ctx.offline ? "en_attente" : "synchronise";
    queueIfOffline(d, ctx, "rapport_mission", { kind: "mission", id: m.id }, input.report, `Rapport ${m.code}`, `rep-${m.id}-${ctx.now}`);
    return { message: ctx.offline ? "Rapport enregistré localement — en attente de synchronisation." : "Rapport de mission enregistré." };
  });

export const invoiceMission: Service<{ id: string; clientId: string; serviceAmount: number }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    const m = must(d.missions.find((x) => x.id === input.id));
    if (m.status !== "terminee") fail("La mission doit être terminée.");
    if (d.invoices.some((i) => i.status !== "annulee" && i.clientId === input.clientId && i.lines.some((l) => l.source?.kind === "mission" && l.source.id === m.id))) fail("Cette mission est déjà facturée pour ce client.");
    const src = { kind: "mission" as const, id: m.id, label: m.code };
    const lines: InvoiceLine[] = [{ id: uid("il"), label: `Intervention terrain — ${m.objective}`, kind: "service", qty: 1, unitPrice: input.serviceAmount, discountPct: 0, source: src }];
    for (const l of m.stock.filter((s) => s.delivered > 0)) {
      const p = d.products.find((x) => x.id === l.productId)!;
      lines.push({ id: uid("il"), label: p.name, kind: "produit", productId: p.id, qty: l.delivered, unitPrice: p.salePrice, discountPct: 0, source: src });
    }
    const invId = buildInvoice(d, ctx, { clientId: input.clientId, lines, notes: `Mission ${m.code}` });
    return { message: "Facture brouillon de mission créée (produits délivrés uniquement, pas les transferts).", data: invId };
  });
