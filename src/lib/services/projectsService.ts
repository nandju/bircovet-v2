import { isHttpUrl } from "../protocols";
import { uid } from "../format";
import type { Project, ProofLink } from "../types";
import { audit, fail, must, nextCode, produce, requireRole, type Service } from "./core";

export type ProjectInput = Pick<Project, "name" | "description" | "budget" | "startDate" | "endDate" | "status" | "ownerId" | "driveUrl"> & { id?: string };

export const saveProject: Service<ProjectInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "comptable"], "gestion des projets");
    if (!input.name.trim()) fail("Nom du projet requis.");
    if (input.budget !== undefined && (input.budget < 0 || Number.isNaN(input.budget))) fail("Enveloppe invalide.");
    if (input.driveUrl && !isHttpUrl(input.driveUrl)) fail("Lien Drive invalide : collez le lien complet (https://…).");
    if (input.startDate && input.endDate && input.endDate < input.startDate) fail("La date de fin précède la date de début.");
    d.projects = d.projects ?? [];
    const clean = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined, driveUrl: input.driveUrl?.trim() || undefined, budget: input.budget || undefined };
    if (input.id) {
      const p = must(d.projects.find((x) => x.id === input.id));
      Object.assign(p, clean);
      audit(d, ctx, { module: "Projets", action: "Modification", target: `${p.code} ${p.name}` });
      return { message: "Projet mis à jour.", data: p.id };
    }
    const id = uid("prj");
    const code = nextCode(d, "prj", "PRJ");
    d.projects.unshift({ ...clean, id, code, establishmentId: ctx.establishmentId, createdAt: ctx.now });
    audit(d, ctx, { module: "Projets", action: "Création", target: `${code} ${clean.name}` });
    return { message: `Projet ${code} créé.`, data: id };
  });

/** Rattache (ou détache) une dépense à un projet. */
export const setExpenseProject: Service<{ id: string; projectId?: string }> = (db, ctx, { id, projectId }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "comptable"], "rattachement à un projet");
    const e = must(d.expenses.find((x) => x.id === id), "Dépense introuvable.");
    if (projectId) {
      const p = must((d.projects ?? []).find((x) => x.id === projectId), "Projet introuvable.");
      if (p.status === "termine") fail("Ce projet est terminé : rouvrez-le pour y rattacher une dépense.");
    }
    e.projectId = projectId || undefined;
    audit(d, ctx, { module: "Finances", action: "Rattachement projet", target: e.code, newValue: projectId ?? "aucun" });
    return { message: projectId ? "Dépense rattachée au projet." : "Dépense détachée du projet." };
  });

const MAX_PHOTOS = 6;

/** Ajoute une preuve à une dépense : lien Drive et/ou photo de facture. */
export const addExpenseProof: Service<{ id: string; link?: Pick<ProofLink, "label" | "url">; photo?: { name: string; dataUrl: string } }> = (db, ctx, { id, link, photo }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "comptable"], "ajout de preuve");
    const e = must(d.expenses.find((x) => x.id === id), "Dépense introuvable.");
    if (!link && !photo) fail("Rien à ajouter.");
    if (link) {
      if (!isHttpUrl(link.url)) fail("Lien invalide : collez le lien de partage complet (https://drive.google.com/…).");
      e.proofLinks = [...(e.proofLinks ?? []), { id: uid("prf"), label: link.label.trim() || "Preuve", url: link.url.trim(), addedById: ctx.user.id, addedAt: ctx.now }];
    }
    if (photo) {
      if (!photo.dataUrl.startsWith("data:image/")) fail("La photo doit être une image.");
      if ((e.photos?.length ?? 0) >= MAX_PHOTOS) fail(`${MAX_PHOTOS} photos maximum par dépense : mettez les autres sur Drive.`);
      e.photos = [...(e.photos ?? []), { id: uid("pho"), name: photo.name || "Photo facture", dataUrl: photo.dataUrl, addedById: ctx.user.id, addedAt: ctx.now }];
    }
    audit(d, ctx, { module: "Finances", action: "Preuve ajoutée", target: e.code, newValue: [link && "lien", photo && "photo"].filter(Boolean).join(" + ") });
    return { message: "Preuve ajoutée." };
  });

export const removeExpenseProof: Service<{ id: string; proofId: string }> = (db, ctx, { id, proofId }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "comptable"], "retrait de preuve");
    const e = must(d.expenses.find((x) => x.id === id), "Dépense introuvable.");
    if (e.status === "approuvee" && ctx.user.roleId !== "dg") fail("Dépense validée : seul le DG peut retirer une preuve.");
    e.proofLinks = (e.proofLinks ?? []).filter((x) => x.id !== proofId);
    e.photos = (e.photos ?? []).filter((x) => x.id !== proofId);
    audit(d, ctx, { module: "Finances", action: "Preuve retirée", target: e.code });
    return { message: "Preuve retirée." };
  });
