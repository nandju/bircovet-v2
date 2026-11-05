import { uid } from "../format";
import type { AdminFile } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

export type AdminFileInput = Omit<AdminFile, "id" | "number" | "updatedAt"> & { id?: string };

const checkUrl = (u?: string) => {
  if (u && !/^https?:\/\/\S+\.\S+/i.test(u.trim())) fail("Lien invalide : collez le lien de partage complet (https://drive.google.com/…).");
};

export const saveAdminFile: Service<AdminFileInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Nom du dossier requis.");
    if (!input.category.trim()) fail("Catégorie requise.");
    checkUrl(input.driveUrl);
    d.adminFiles = d.adminFiles ?? [];
    const clean = { ...input, name: input.name.trim(), driveUrl: input.driveUrl?.trim() || undefined, dueDate: input.dueDate || undefined };
    if (input.id) {
      const f = must(d.adminFiles.find((x) => x.id === input.id));
      Object.assign(f, clean, { updatedAt: ctx.now });
      audit(d, ctx, { module: "Dossiers administratifs", action: "Modification", target: `${f.number} — ${f.name}` });
      return { message: "Dossier mis à jour.", data: f.id };
    }
    const n = Math.max(0, ...d.adminFiles.map((f) => Number(f.number) || 0)) + 1;
    const id = uid("adm");
    d.adminFiles.push({ ...clean, id, number: String(n).padStart(3, "0"), updatedAt: ctx.now });
    return { message: `Dossier ${String(n).padStart(3, "0")} créé.`, data: id };
  });

export const setAdminFileStatus: Service<{ id: string; status: AdminFile["status"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const f = must((d.adminFiles ?? []).find((x) => x.id === input.id));
    f.status = input.status;
    f.updatedAt = ctx.now;
    return { message: input.status === "complet" ? "Dossier complété." : "Statut mis à jour." };
  });

export const setDirectoryLink: Service<{ id: string; url: string }> = (db, _ctx, input) =>
  produce(db, (d) => {
    checkUrl(input.url);
    const e = must((d.adminDirectory ?? []).find((x) => x.id === input.id));
    e.url = input.url.trim() || undefined;
    return { message: input.url.trim() ? "Lien Drive enregistré." : "Lien retiré." };
  });

export const toggleObligation: Service<{ id: string; year: string }> = (db, _ctx, input) =>
  produce(db, (d) => {
    const o = must((d.adminObligations ?? []).find((x) => x.id === input.id));
    o.done = { ...(o.done ?? {}), [input.year]: !o.done?.[input.year] };
    return { message: o.done[input.year] ? `Obligation ${input.year} faite.` : "Obligation remise à faire." };
  });
