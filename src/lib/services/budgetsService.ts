import { budgetTotal } from "../budgets";
import { uid } from "../format";
import type { Budget } from "../types";
import { audit, fail, must, nextCode, notify, produce, type Service } from "./core";

export type BudgetInput = Pick<Budget, "title" | "period" | "lines" | "justification"> & { id?: string };

const PREPARERS = ["dg", "assistant", "accueil", "comptable", "vet"];

export const saveBudget: Service<BudgetInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!PREPARERS.includes(ctx.user.roleId)) fail("Action non autorisée.");
    if (!input.title.trim()) fail("Intitulé requis.");
    if (!/^\d{4}-\d{2}$/.test(input.period)) fail("Mois du budget requis.");
    const lines = input.lines.filter((l) => l.label.trim() || l.amount > 0);
    if (!lines.length) fail("Ajoutez au moins une ligne.");
    if (lines.some((l) => !(l.amount > 0) || !l.label.trim())) fail("Chaque ligne a un libellé et un montant.");
    d.budgets = d.budgets ?? [];
    if (input.id) {
      const b = must(d.budgets.find((x) => x.id === input.id));
      if (b.status === "valide" && ctx.user.roleId !== "dg") fail("Budget validé : seul le DG peut le modifier.");
      Object.assign(b, { title: input.title.trim(), period: input.period, lines, justification: input.justification });
      if (b.status === "refuse") b.status = "brouillon";
      b.history.push({ date: ctx.now, userId: ctx.user.id, text: "Budget modifié" });
      return { message: "Budget enregistré.", data: b.id };
    }
    const id = uid("bud");
    d.budgets.unshift({ id, code: nextCode(d, "budget", "BUD"), title: input.title.trim(), period: input.period, establishmentId: ctx.establishmentId, preparedById: ctx.user.id, lines, justification: input.justification, status: ctx.user.roleId === "dg" ? "valide" : "brouillon", ...(ctx.user.roleId === "dg" ? { decidedById: ctx.user.id, decidedAt: ctx.now } : {}), history: [{ date: ctx.now, userId: ctx.user.id, text: "Budget créé" }] });
    return { message: ctx.user.roleId === "dg" ? "Budget créé et validé." : "Budget créé en brouillon : présentez-le au DG.", data: id };
  });

export const submitBudget: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const b = must((d.budgets ?? []).find((x) => x.id === id));
    if (!["brouillon", "refuse"].includes(b.status)) fail("Budget déjà soumis ou validé.");
    b.status = "soumis";
    b.submittedAt = ctx.now;
    b.history.push({ date: ctx.now, userId: ctx.user.id, text: "Présenté au DG pour validation" });
    notify(d, ctx, { title: `Budget à valider : ${b.title}`, body: `${ctx.user.name} présente un budget de ${budgetTotal(b).toLocaleString("fr-FR")} FCFA (${b.period}).`, level: "alerte", toRoles: ["dg"], link: "/budgets", push: true, rule: "budget" });
    return { message: "Budget présenté au DG." };
  });

export const decideBudget: Service<{ id: string; approve: boolean; note: string; amounts?: Record<string, number> }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG valide un budget.");
    const b = must((d.budgets ?? []).find((x) => x.id === input.id));
    if (b.status !== "soumis") fail("Ce budget n'est pas en attente de validation.");
    if (!input.approve && !input.note.trim()) fail("Motif du refus requis.");
    const changed: string[] = [];
    if (input.approve && input.amounts)
      for (const l of b.lines) {
        const v = input.amounts[l.id];
        if (v !== undefined && v !== l.amount) {
          if (!(v >= 0)) fail("Montant invalide.");
          changed.push(`${l.label} : ${l.amount.toLocaleString("fr-FR")} → ${v.toLocaleString("fr-FR")}`);
          l.amount = v;
        }
      }
    b.status = input.approve ? "valide" : "refuse";
    b.decidedById = ctx.user.id;
    b.decidedAt = ctx.now;
    b.decisionNote = input.note.trim() || undefined;
    b.history.push({ date: ctx.now, userId: ctx.user.id, text: `${input.approve ? "Validé" : "Refusé"}${changed.length ? ` (ajusté : ${changed.join(" ; ")})` : ""}${input.note ? ` — ${input.note}` : ""}` });
    notify(d, ctx, { title: `Budget ${input.approve ? "validé" : "refusé"} : ${b.title}`, body: input.note || (changed.length ? "Montants ajustés par le DG." : "Vous pouvez engager les dépenses prévues."), level: input.approve ? "succes" : "alerte", toUserIds: [b.preparedById], link: "/budgets", push: true, rule: "budget" });
    audit(d, ctx, { module: "Budgets", action: input.approve ? "Validation" : "Refus", target: b.code });
    return { message: input.approve ? "Budget validé." : "Budget refusé." };
  });

export const setPOBudgetLine: Service<{ poId: string; lineId?: string }> = (db, _ctx, input) =>
  produce(db, (d) => {
    const po = must(d.purchaseOrders.find((x) => x.id === input.poId));
    if (!["brouillon"].includes(po.status)) fail("Imputation modifiable uniquement sur un brouillon.");
    po.budgetLineId = input.lineId || undefined;
    return { message: "Ligne de budget imputée." };
  });
