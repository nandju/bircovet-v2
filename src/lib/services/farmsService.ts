import { uid } from "../format";
import type { AnimalMovement, Farm, FarmBuilding, FarmLot, FarmVisit } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

export type FarmInput = Pick<Farm, "name" | "clientId" | "type" | "location" | "region" | "gps" | "access" | "managerName" | "managerPhone" | "status">;

export const createFarm: Service<FarmInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Nom de l'exploitation requis.");
    must(d.clients.find((c) => c.id === input.clientId), "Client associé introuvable.");
    const id = uid("farm");
    const code = nextCode(d, "farm", "EXP");
    d.farms.unshift({ ...input, id, code, contacts: [], buildings: [], lots: [], headcounts: [], movements: [], visits: [], createdAt: ctx.now.slice(0, 10) });
    audit(d, ctx, { module: "Exploitations", action: "Création", target: `${code} — ${input.name}` });
    return { message: `Exploitation ${code} créée.`, data: id };
  });

export const updateFarm: Service<{ id: string; patch: Partial<FarmInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const f = must(d.farms.find((x) => x.id === id));
    Object.assign(f, patch);
    audit(d, ctx, { module: "Exploitations", action: "Modification", target: f.code });
    return { message: "Exploitation mise à jour." };
  });

export const addBuilding: Service<{ farmId: string; b: Omit<FarmBuilding, "id"> }> = (db, ctx, { farmId, b }) =>
  produce(db, (d) => {
    if (!b.name.trim()) fail("Nom du bâtiment requis.");
    must(d.farms.find((x) => x.id === farmId)).buildings.push({ ...b, id: uid("bat") });
    return { message: "Bâtiment ajouté." };
  });

export const addFarmLot: Service<{ farmId: string; lot: Omit<FarmLot, "id" | "status">; initialCount: number }> = (db, ctx, { farmId, lot, initialCount }) =>
  produce(db, (d) => {
    if (!lot.name.trim()) fail("Nom du lot / troupeau requis.");
    const f = must(d.farms.find((x) => x.id === farmId));
    const id = uid("flot");
    f.lots.push({ ...lot, id, status: "actif" });
    if (initialCount > 0) {
      f.movements.push({ id: uid("amv"), lotId: id, date: lot.startDate, type: "entree", count: initialCount, note: "Mise en place" });
      f.headcounts.push({ id: uid("hc"), lotId: id, date: lot.startDate, count: initialCount, authorId: ctx.user.id, source: "declaration" });
    }
    return { message: "Lot / troupeau ajouté." };
  });

export const addHeadcount: Service<{ farmId: string; lotId: string; date: string; count: number }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (input.count < 0) fail("Effectif invalide.");
    must(d.farms.find((x) => x.id === input.farmId)).headcounts.push({ id: uid("hc"), lotId: input.lotId, date: input.date, count: input.count, authorId: ctx.user.id, source: "visite" });
    return { message: "Effectif daté enregistré." };
  });

export const addAnimalMovement: Service<{ farmId: string; mv: Omit<AnimalMovement, "id"> }> = (db, ctx, { farmId, mv }) =>
  produce(db, (d) => {
    if (!(mv.count > 0)) fail("Le nombre d'animaux doit être positif.");
    must(d.farms.find((x) => x.id === farmId)).movements.push({ ...mv, id: uid("amv") });
    return { message: "Mouvement d'animaux enregistré." };
  });

export const addFarmVisit: Service<{ farmId: string; visit: Omit<FarmVisit, "id"> }> = (db, ctx, { farmId, visit }) =>
  produce(db, (d) => {
    if (!visit.purpose.trim()) fail("Objet de la visite requis.");
    const f = must(d.farms.find((x) => x.id === farmId));
    f.visits.unshift({ ...visit, id: uid("vis") });
    audit(d, ctx, { module: "Exploitations", action: "Visite enregistrée", target: f.code });
    return { message: "Visite enregistrée." };
  });

export function currentHeadcount(f: Farm, lotId: string): number {
  const last = f.headcounts.filter((h) => h.lotId === lotId).sort((a, b) => b.date.localeCompare(a.date))[0];
  return last?.count ?? 0;
}
