import { uid } from "../format";
import { LEAVE_META, leaveBalance, leaveDays } from "../staff";
import type { LeaveRequest, StaffEvaluation, StaffObjective } from "../types";
import { audit, fail, must, notify, produce, type Service } from "./core";

const isDG = (r: string) => r === "dg";

export type LeaveInput = Pick<LeaveRequest, "userId" | "kind" | "start" | "end" | "hours" | "reason">;

export const requestLeave: Service<LeaveInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (input.userId !== ctx.user.id && !isDG(ctx.user.roleId)) fail("Seul le DG peut saisir une demande pour un autre membre.");
    must(d.users.find((u) => u.id === input.userId), "Membre introuvable.");
    if (!input.start || !input.end || input.end < input.start) fail("Dates invalides.");
    if (!input.reason.trim()) fail("Motif requis.");
    if (input.kind === "permission" && input.start !== input.end && input.hours) fail("Une permission en heures porte sur une seule journée.");
    const overlap = (d.leaves ?? []).some((l) => l.userId === input.userId && ["en_attente", "approuvee"].includes(l.status) && l.start <= input.end && l.end >= input.start);
    if (overlap) fail("Une demande existe déjà sur cette période.");
    if (input.kind === "conge") {
      const b = leaveBalance(d, input.userId, input.start.slice(0, 4));
      const need = leaveDays({ ...input, id: "", status: "en_attente", requestedAt: "" });
      if (need > b.left - b.pending) fail(`Solde insuffisant : ${b.left - b.pending} jour(s) disponible(s), ${need} demandé(s).`);
    }
    const id = uid("lv");
    d.leaves = d.leaves ?? [];
    d.leaves.unshift({ ...input, reason: input.reason.trim(), id, status: "en_attente", requestedAt: ctx.now });
    notify(d, ctx, { title: `${LEAVE_META[input.kind].label} demandée`, body: `${d.users.find((u) => u.id === input.userId)?.name} : du ${input.start} au ${input.end}.`, level: "info", link: "/personnel" });
    return { message: "Demande envoyée.", data: id };
  });

export const decideLeave: Service<{ id: string; approve: boolean; note?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!isDG(ctx.user.roleId)) fail("Seul le DG valide les congés et permissions.");
    const l = must((d.leaves ?? []).find((x) => x.id === input.id));
    if (l.status !== "en_attente") fail("Demande déjà traitée.");
    if (!input.approve && !input.note?.trim()) fail("Motif du refus requis.");
    l.status = input.approve ? "approuvee" : "refusee";
    l.decidedById = ctx.user.id;
    l.decidedAt = ctx.now;
    l.decisionNote = input.note?.trim() || undefined;
    if (input.approve) {
      // L'absence apparaît dans l'agenda comme indisponibilité.
      const unaId = uid("una");
      d.unavailabilities.push({ id: unaId, userId: l.userId, start: `${l.start}T${l.hours?.from ?? "07:00"}`, end: `${l.end}T${l.hours?.to ?? "20:00"}`, reason: LEAVE_META[l.kind].label });
      l.unavailabilityId = unaId;
    }
    audit(d, ctx, { module: "Personnel", action: input.approve ? "Absence approuvée" : "Absence refusée", target: `${d.users.find((u) => u.id === l.userId)?.name} ${l.start}→${l.end}` });
    return { message: input.approve ? "Demande approuvée et ajoutée à l'agenda." : "Demande refusée." };
  });

export const cancelLeave: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const l = must((d.leaves ?? []).find((x) => x.id === id));
    if (l.userId !== ctx.user.id && !isDG(ctx.user.roleId)) fail("Action non autorisée.");
    if (l.status === "refusee" || l.status === "annulee") fail("Demande déjà close.");
    l.status = "annulee";
    if (l.unavailabilityId) d.unavailabilities = d.unavailabilities.filter((u) => u.id !== l.unavailabilityId);
    return { message: "Demande annulée." };
  });

export type ObjectiveInput = Pick<StaffObjective, "userId" | "title" | "metric" | "target" | "unit" | "period" | "dueDate"> & { id?: string; current?: number };

export const saveObjective: Service<ObjectiveInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!isDG(ctx.user.roleId) && input.userId !== ctx.user.id) fail("Seul le DG fixe les objectifs des autres membres.");
    if (!input.title.trim()) fail("Intitulé requis.");
    if (!(input.target > 0)) fail("Cible chiffrée requise.");
    if (!input.dueDate) fail("Échéance requise.");
    d.objectives = d.objectives ?? [];
    if (input.id) {
      const o = must(d.objectives.find((x) => x.id === input.id));
      Object.assign(o, { ...input, current: input.current ?? o.current });
      return { message: "Objectif mis à jour.", data: o.id };
    }
    const id = uid("obj");
    d.objectives.unshift({ ...input, id, current: input.current ?? 0, status: "en_cours", reviews: [], createdById: ctx.user.id, createdAt: ctx.now });
    return { message: "Objectif enregistré.", data: id };
  });

export const reviewObjective: Service<{ id: string; value?: number; text: string; status?: StaffObjective["status"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const o = must((d.objectives ?? []).find((x) => x.id === input.id));
    if (o.userId !== ctx.user.id && !isDG(ctx.user.roleId)) fail("Action non autorisée.");
    if (input.status && input.status !== "en_cours" && !isDG(ctx.user.roleId)) fail("Seul le DG clôt un objectif.");
    if (!input.text.trim() && input.value === undefined) fail("Saisissez un point d'étape.");
    if (input.value !== undefined) o.current = Math.max(0, input.value);
    o.reviews.unshift({ id: uid("rev"), date: ctx.now, byId: ctx.user.id, text: input.text.trim(), value: input.value });
    if (input.status) o.status = input.status;
    else if (o.current >= o.target) o.status = "atteint";
    return { message: "Point d'étape enregistré." };
  });

export type EvaluationInput = Omit<StaffEvaluation, "id" | "date" | "byId"> & { id?: string };

export const saveEvaluation: Service<EvaluationInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!isDG(ctx.user.roleId)) fail("Seul le DG note le personnel.");
    if (input.userId === ctx.user.id) fail("Vous ne pouvez pas vous noter vous-même.");
    must(d.users.find((u) => u.id === input.userId), "Membre introuvable.");
    if (!input.period.trim()) fail("Période requise.");
    const vals = Object.values(input.scores);
    if (!vals.length || vals.some((v) => !(v >= 1 && v <= 5))) fail("Notez chaque critère de 1 à 5.");
    d.evaluations = d.evaluations ?? [];
    if (input.id) {
      const e = must(d.evaluations.find((x) => x.id === input.id));
      Object.assign(e, { ...input, date: ctx.now });
      return { message: "Évaluation mise à jour.", data: e.id };
    }
    const id = uid("eval");
    d.evaluations.unshift({ ...input, period: input.period.trim(), id, date: ctx.now, byId: ctx.user.id });
    notify(d, ctx, { title: "Nouvelle évaluation", body: `Votre évaluation « ${input.period} » est disponible.`, level: "info", toUserIds: [input.userId], link: "/personnel" });
    audit(d, ctx, { module: "Personnel", action: "Évaluation", target: `${d.users.find((u) => u.id === input.userId)?.name} — ${input.period}` });
    return { message: "Évaluation enregistrée et communiquée au membre.", data: id };
  });
