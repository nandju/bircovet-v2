import { uid } from "../format";
import { farmTypeFromHerd, isMapsUrl } from "../farmProfile";
import type { AnimalMovement, Farm, FarmBuilding, FarmIntervention, FarmLot, FarmScaleSettings, FarmVisit } from "../types";
import { audit, fail, must, nextCode, produce, type Service } from "./core";

export type FarmInput = Pick<Farm, "name" | "clientId" | "type" | "location" | "region" | "gps" | "access" | "managerName" | "managerPhone" | "status" | "mapsUrl"> & {
  /** Cheptel initial : une ligne par espèce (crée un lot par espèce). */
  herd?: { species: string; count: number; category?: string }[];
};

export const createFarm: Service<FarmInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Nom de l'exploitation requis.");
    if (input.mapsUrl && !isMapsUrl(input.mapsUrl)) fail("Le lien doit être un lien Google Maps (maps.app.goo.gl, google.com/maps…).");
    must(d.clients.find((c) => c.id === input.clientId), "Client associé introuvable.");
    const id = uid("farm");
    const code = nextCode(d, "farm", "EXP");
    const { herd, ...base } = input;
    const lines = (herd ?? []).filter((h) => h.species && h.count > 0);
    const day = ctx.now.slice(0, 10);
    const lots = lines.map((h) => ({ id: uid("flot"), name: `${h.species}${h.category ? ` — ${h.category}` : ""}`, species: h.species, category: h.category || undefined, startDate: day, status: "actif" as const }));
    d.farms.unshift({
      ...base,
      type: lines.length ? farmTypeFromHerd(lines.map((h) => h.species)) : base.type,
      id,
      code,
      contacts: [],
      buildings: [],
      lots,
      headcounts: lots.map((l, k) => ({ id: uid("hc"), lotId: l.id, date: day, count: lines[k].count, authorId: ctx.user.id, source: "declaration" as const })),
      movements: lots.map((l, k) => ({ id: uid("amv"), lotId: l.id, date: day, type: "entree" as const, count: lines[k].count, note: "Effectif déclaré à l'enregistrement" })),
      visits: [],
      interventions: [],
      createdAt: day,
    });
    audit(d, ctx, { module: "Exploitations", action: "Création", target: `${code} — ${input.name}` });
    return { message: `Exploitation ${code} créée.`, data: id };
  });

export const updateFarm: Service<{ id: string; patch: Partial<FarmInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const f = must(d.farms.find((x) => x.id === id));
    if (patch.mapsUrl && !isMapsUrl(patch.mapsUrl)) fail("Le lien doit être un lien Google Maps (maps.app.goo.gl, google.com/maps…).");
    const { herd: _herd, ...rest } = patch;
    void _herd;
    Object.assign(f, rest);
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

export const addFarmIntervention: Service<{ farmId: string; it: Omit<FarmIntervention, "id" | "byId"> }> = (db, ctx, { farmId, it }) =>
  produce(db, (d) => {
    const f = must(d.farms.find((x) => x.id === farmId));
    if (!it.species) fail("Espèce requise.");
    if (!(it.count >= 0)) fail("Nombre d'animaux invalide.");
    if (it.lab?.reportUrl && !/^https?:\/\//i.test(it.lab.reportUrl)) fail("Lien du compte rendu invalide (https://…).");
    f.interventions = f.interventions ?? [];
    f.interventions.unshift({ ...it, id: uid("fint"), byId: ctx.user.id });
    audit(d, ctx, { module: "Exploitations", action: "Intervention", target: `${f.code} — ${it.kind} ${it.species}` });
    return { message: "Intervention enregistrée." };
  });

/** Catégorie fixée à la main (ou retour au calcul automatique si scale = null). */
export const setFarmScale: Service<{ farmId: string; scale: "petit" | "moyen" | "gros" | null; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const f = must(d.farms.find((x) => x.id === input.farmId));
    if (input.scale && !input.reason.trim()) fail("Indiquez pourquoi vous fixez la catégorie.");
    f.scaleOverride = input.scale ? { scale: input.scale, reason: input.reason.trim(), byId: ctx.user.id, at: ctx.now } : undefined;
    audit(d, ctx, { module: "Exploitations", action: "Catégorie d'éleveur", target: `${f.code} → ${input.scale ?? "automatique"}` });
    return { message: input.scale ? "Catégorie fixée." : "Catégorie recalculée automatiquement." };
  });

/** Mise à jour directe de l'effectif d'un lot (historisée en interne). */
export const setLotCount: Service<{ farmId: string; lotId: string; count: number; status?: "actif" | "cloture" }> = (db, ctx, input) =>
  produce(db, (d) => {
    const f = must(d.farms.find((x) => x.id === input.farmId));
    const l = must(f.lots.find((x) => x.id === input.lotId));
    if (!(input.count >= 0)) fail("Effectif invalide.");
    f.headcounts.push({ id: uid("hc"), lotId: l.id, date: ctx.now.slice(0, 10), count: input.count, authorId: ctx.user.id, source: "declaration" });
    if (input.status) l.status = input.status;
    return { message: "Effectif mis à jour." };
  });

export const saveFarmScaleSettings: Service<FarmScaleSettings> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG règle les catégories d'éleveurs.");
    for (const [k, [a, b]] of Object.entries(input.herd)) if (!(a >= 0 && b > a)) fail(`Seuils incohérents pour ${k} : le « gros » doit dépasser le « moyen ».`);
    if (!(input.revenue[1] > input.revenue[0])) fail("Seuils de chiffre d'affaires incohérents.");
    d.settings.farmScale = input;
    return { message: "Catégories d'éleveurs enregistrées." };
  });
