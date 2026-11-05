import { uid } from "../format";
import { isHttpUrl } from "../protocols";
import type { ExternalLink, Protocol } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

export type ProtocolInput = Pick<Protocol, "title" | "category" | "subject" | "species" | "summary" | "steps" | "materials" | "warnings" | "links"> & { id?: string };

const canValidate = (r: string) => r === "dg" || r === "vet";

export const saveProtocol: Service<ProtocolInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Titre requis.");
    if (!input.steps.filter((s) => s.text.trim()).length) fail("Ajoutez au moins une étape.");
    for (const l of input.links) if (!isHttpUrl(l.url)) fail(`Lien invalide : ${l.url}`);
    d.protocols = d.protocols ?? [];
    const clean = { ...input, title: input.title.trim(), steps: input.steps.filter((s) => s.text.trim()), materials: input.materials.filter(Boolean) };
    if (input.id) {
      const p = must(d.protocols.find((x) => x.id === input.id));
      Object.assign(p, clean, { version: p.version + 1, updatedAt: ctx.now, status: canValidate(ctx.user.roleId) ? p.status : "brouillon", validatedById: canValidate(ctx.user.roleId) ? p.validatedById : undefined });
      audit(d, ctx, { module: "Protocoles", action: "Modification", target: `${p.code} v${p.version}` });
      return { message: `Fiche mise à jour (version ${p.version}).`, data: p.id };
    }
    const id = uid("pro");
    const code = nextCode(d, "pro", "PRO");
    d.protocols.unshift({ ...clean, id, code, status: "brouillon", version: 1, authorId: ctx.user.id, updatedAt: ctx.now });
    return { message: `Fiche ${code} créée (brouillon).`, data: id };
  });

export const setProtocolStatus: Service<{ id: string; status: Protocol["status"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!canValidate(ctx.user.roleId)) fail("Seuls le DG et les vétérinaires valident une fiche.");
    const p = must((d.protocols ?? []).find((x) => x.id === input.id));
    p.status = input.status;
    p.validatedById = input.status === "valide" ? ctx.user.id : p.validatedById;
    p.updatedAt = ctx.now;
    return { message: input.status === "valide" ? "Fiche validée : visible par toute l'équipe." : input.status === "archive" ? "Fiche archivée." : "Fiche repassée en brouillon." };
  });

export const addExternalLink: Service<Omit<ExternalLink, "id" | "addedById" | "addedAt">> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.label.trim()) fail("Donnez un nom au lien.");
    if (!isHttpUrl(input.url)) fail("Adresse invalide : collez le lien complet (https://…).");
    d.links = d.links ?? [];
    d.links.unshift({ ...input, label: input.label.trim(), url: input.url.trim(), id: uid("lnk"), addedById: ctx.user.id, addedAt: ctx.now });
    return { message: "Lien ajouté au dossier." };
  });

export const removeExternalLink: Service<{ id: string }> = (db, _ctx, { id }) =>
  produce(db, (d) => {
    d.links = (d.links ?? []).filter((l) => l.id !== id);
    return { message: "Lien retiré." };
  });
