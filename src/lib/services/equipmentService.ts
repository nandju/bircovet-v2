import { isHttpUrl } from "../protocols";
import { uid } from "../format";
import type { Equipment } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

export type EquipmentInput = Omit<Equipment, "id" | "code" | "createdAt" | "updatedAt" | "establishmentId"> & { id?: string; establishmentId?: string };

const canManage = (r: string) => r === "dg" || r === "comptable" || r === "vet" || r === "accueil";

export const saveEquipment: Service<EquipmentInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!canManage(ctx.user.roleId)) fail("Vous n'avez pas le droit de modifier l'inventaire du matériel.");
    if (!input.name.trim()) fail("Nom du matériel requis.");
    if (!(input.quantity >= 1)) fail("Quantité : 1 minimum.");
    if (input.unitCost < 0) fail("Montant d'achat invalide.");
    if (input.invoiceUrl && !isHttpUrl(input.invoiceUrl)) fail("Lien de la facture invalide (https://…).");
    d.equipment = d.equipment ?? [];
    const clean = { ...input, name: input.name.trim(), category: input.category || "Autre", invoiceUrl: input.invoiceUrl?.trim() || undefined };
    if (input.id) {
      const e = must(d.equipment.find((x) => x.id === input.id));
      Object.assign(e, clean, { updatedAt: ctx.now });
      audit(d, ctx, { module: "Matériel", action: "Modification", target: `${e.code} ${e.name}` });
      return { message: "Matériel mis à jour.", data: e.id };
    }
    const id = uid("eqp");
    const code = nextCode(d, "eqp", "MAT");
    d.equipment.unshift({ ...clean, id, code, establishmentId: input.establishmentId ?? ctx.establishmentId, createdAt: ctx.now, updatedAt: ctx.now });
    audit(d, ctx, { module: "Matériel", action: "Ajout", target: `${code} ${clean.name}` });
    return { message: `${clean.name} ajouté à l'inventaire (${code}).`, data: id };
  });

export const deleteEquipment: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG supprime une ligne d'inventaire (sinon : « Réformé »).");
    const e = must((d.equipment ?? []).find((x) => x.id === id));
    d.equipment = (d.equipment ?? []).filter((x) => x.id !== id);
    audit(d, ctx, { module: "Matériel", action: "Suppression", target: `${e.code} ${e.name}` });
    return { message: "Ligne supprimée." };
  });
