import { uid } from "../format";
import type { ApprovalRequest } from "../types";
import { audit, fail, must, nextCode, notify, produce, type Service } from "./core";

export type ApprovalInput = Pick<ApprovalRequest, "refKind" | "refId" | "link" | "title" | "detail" | "amount" | "urgency">;

export const APPROVAL_STATUS: Record<ApprovalRequest["status"], { label: string; chip: string }> = {
  en_attente: { label: "En attente d'aval", chip: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  approuvee: { label: "Aval donné", chip: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  refusee: { label: "Refusé", chip: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  info_demandee: { label: "Précisions demandées", chip: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" },
};

/** Un collaborateur demande l'aval du directeur ; le DG reçoit une notification push. */
export const requestApproval: Service<ApprovalInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Objet de la décision requis.");
    if (!input.detail.trim()) fail("Expliquez la décision à valider.");
    const dg = must(d.users.find((u) => u.roleId === "dg" && u.active), "Aucun directeur actif.");
    if ((d.approvals ?? []).some((a) => a.status === "en_attente" && a.refId && a.refId === input.refId && a.title === input.title)) fail("Une demande identique est déjà en attente.");
    const id = uid("apv");
    const code = nextCode(d, "apv", "AVAL");
    d.approvals = d.approvals ?? [];
    d.approvals.unshift({ ...input, title: input.title.trim(), detail: input.detail.trim(), id, code, requestedById: ctx.user.id, requestedAt: ctx.now, toUserId: dg.id, status: "en_attente", history: [{ date: ctx.now, userId: ctx.user.id, text: "Demande d'aval envoyée" }] });
    notify(d, ctx, { title: `${input.urgency === "urgente" ? "URGENT — " : ""}Aval demandé : ${input.title}`, body: `${ctx.user.name} : ${input.detail.slice(0, 140)}`, level: input.urgency === "urgente" ? "critique" : "alerte", link: "/aval", toUserIds: [dg.id], push: true, rule: "aval" });
    audit(d, ctx, { module: "Avals", action: "Demande", target: `${code} — ${input.title}` });
    return { message: "Demande envoyée au directeur.", data: id };
  });

export const decideApproval: Service<{ id: string; decision: "approuvee" | "refusee" | "info_demandee"; note: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const a = must((d.approvals ?? []).find((x) => x.id === input.id));
    if (ctx.user.id !== a.toUserId && ctx.user.roleId !== "dg") fail("Seul le directeur décide.");
    if (a.status === "approuvee" || a.status === "refusee") fail("Décision déjà rendue.");
    if (input.decision !== "approuvee" && !input.note.trim()) fail("Un commentaire est requis.");
    a.status = input.decision;
    a.decisionNote = input.note.trim() || undefined;
    a.decidedAt = ctx.now;
    a.history.push({ date: ctx.now, userId: ctx.user.id, text: `${APPROVAL_STATUS[input.decision].label}${input.note ? ` — ${input.note}` : ""}` });
    notify(d, ctx, { title: `${APPROVAL_STATUS[input.decision].label} : ${a.title}`, body: input.note || "Le directeur a validé votre demande.", level: input.decision === "approuvee" ? "succes" : "alerte", link: a.link ?? "/aval", toUserIds: [a.requestedById], push: true, rule: "aval" });
    audit(d, ctx, { module: "Avals", action: APPROVAL_STATUS[input.decision].label, target: a.code });
    return { message: "Décision transmise au demandeur." };
  });

/** Le demandeur complète sa demande (après « précisions demandées »). */
export const answerApproval: Service<{ id: string; text: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const a = must((d.approvals ?? []).find((x) => x.id === input.id));
    if (a.requestedById !== ctx.user.id) fail("Seul le demandeur peut compléter.");
    if (!input.text.trim()) fail("Réponse vide.");
    a.history.push({ date: ctx.now, userId: ctx.user.id, text: input.text.trim() });
    a.status = "en_attente";
    notify(d, ctx, { title: `Précisions reçues : ${a.title}`, body: input.text.slice(0, 140), level: "alerte", link: "/aval", toUserIds: [a.toUserId], push: true, rule: "aval" });
    return { message: "Précisions envoyées au directeur." };
  });
