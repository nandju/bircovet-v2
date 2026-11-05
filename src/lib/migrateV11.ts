/**
 * Schéma v11 : exploitations multi-espèces (sans bâtiments), interventions du cabinet,
 * traitements suivis (clinique / domicile), congés, permissions et objectifs du personnel.
 */
import { speciesOf } from "./farmProfile";
import { addDay } from "./treatments";
import type { DemoDB, DoseLog, FarmIntervention, LeaveRequest, StaffObjective, TreatmentCourse } from "./types";

const PET = ["Chien", "Chat"];

export function migrateToV11(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.treatments && db.leaves && db.objectives) return { ...db, schemaVersion: 11 };
  const users = new Set(db.users.map((u) => u.id));
  const u = (id: string, fb = db.users[0]?.id ?? "") => (users.has(id) ? id : fb);

  /* ---- Exploitations : espèces normalisées, catégories, multi-espèces, interventions ---- */
  const extra: Record<number, { species: string; category: string; count: number }> = {
    1: { species: "Caprin", category: "Chèvres naines", count: 35 },
    2: { species: "Volaille", category: "Poulets traditionnels", count: 300 },
    3: { species: "Caprin", category: "Chèvres du Sahel", count: 60 },
  };
  const PROBLEMS: [FarmIntervention["kind"], string, string, string][] = [
    ["vaccination", "Volaille", "Vaccin Newcastle + Gumboro", "prévention newcastle"],
    ["traitement", "Volaille", "Amprolium", "coccidiose"],
    ["deparasitage", "Bovin", "Ivermectine", "parasitisme gastro-intestinal"],
    ["traitement", "Bovin", "Oxytétracycline LA", "boiterie / panaris"],
    ["traitement", "Porcin", "Fer dextran + colistine", "diarrhée des porcelets"],
    ["vaccination", "Porcin", "Vaccin rouget", "prévention rouget"],
    ["deparasitage", "Ovin", "Albendazole", "parasitisme gastro-intestinal"],
    ["traitement", "Ovin", "Oxytétracycline LA", "pneumonie"],
    ["prelevement", "Poisson", "Analyse d'eau", "mortalités en bassin"],
    ["traitement", "Caprin", "Ivermectine", "gale"],
  ];
  const farms = db.farms.map((f, i) => {
    let lots = f.lots.map((l) => {
      const sp = speciesOf(l.species);
      return { ...l, species: sp, category: l.category ?? (sp !== l.species ? l.species : undefined), buildingId: undefined };
    });
    const headcounts = [...f.headcounts];
    const movements = [...f.movements];
    const x = extra[i];
    if (x && !lots.some((l) => l.species === x.species)) {
      const id = `${f.id}-lot-x`;
      lots = [...lots, { id, name: `${x.species} — ${x.category}`, species: x.species, category: x.category, startDate: addDay(today, -120), status: "actif" as const, buildingId: undefined }];
      headcounts.push({ id: `${id}-h1`, lotId: id, date: addDay(today, -20), count: x.count, authorId: u("u-vet2"), source: "visite" });
      movements.push({ id: `${id}-m1`, lotId: id, date: addDay(today, -120), type: "entree", count: x.count, note: "Effectif déclaré" });
    }
    const species = [...new Set(lots.map((l) => l.species))];
    const interventions: FarmIntervention[] = f.interventions ?? PROBLEMS.filter((p) => species.includes(p[1])).slice(0, 3).map((p, k) => {
      const lot = lots.find((l) => l.species === p[1]);
      const n = (headcounts.filter((h) => h.lotId === lot?.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.count ?? 50);
      return { id: `${f.id}-int-${k}`, date: addDay(today, -(6 + k * 17 + i * 3)), kind: p[0], species: p[1], lotId: lot?.id, count: p[0] === "vaccination" || p[0] === "deparasitage" ? n : Math.max(1, Math.round(n * 0.08)), product: p[2], problem: p[3], note: "Intervention de démonstration (fictive).", byId: u(k % 2 ? "u-dg" : "u-vet2") };
    });
    return { ...f, type: species.length > 1 ? ("mixte" as const) : f.type, buildings: [], lots, headcounts, movements, interventions };
  });

  /* ---- Traitements suivis ---- */
  const treatments: TreatmentCourse[] = db.treatments ? [...db.treatments] : [];
  let n = 0;
  const code = () => `TRT-${String(++n).padStart(4, "0")}`;
  const doses = (c: Omit<TreatmentCourse, "doses">, by: DoseLog["by"], who: string[], skip: (day: string, slot: string, k: number) => DoseLog["status"] | "none"): DoseLog[] => {
    const out: DoseLog[] = [];
    let k = 0;
    for (let i = 0; i < c.days; i++) {
      const day = addDay(c.startDate, i);
      for (const slot of c.slots) {
        if (`${day}T${slot}` > nowLocal) continue;
        const s = skip(day, slot, k++);
        if (s === "none") continue;
        out.push({ id: `${c.id}-d${k}`, day, slot, status: s, by, userId: who[k % who.length], at: `${day}T${slot}`, channel: by === "proprietaire" ? (k % 3 ? "whatsapp" : "appel") : "sur_place", note: s === "donne" ? undefined : s === "refuse" ? "A recraché le comprimé" : "Oubli signalé par le propriétaire" });
      }
    }
    return out;
  };
  if (!db.treatments) {
    const stays = db.hospitalizations.filter((h) => h.status === "en_cours");
    stays.forEach((h, i) => {
      const start = h.admittedAt.slice(0, 10);
      const base1: Omit<TreatmentCourse, "doses"> = { id: `trt-h${i}a`, code: code(), patientId: h.patientId, clientId: h.clientId, setting: "hospitalisation", hospitalizationId: h.id, label: i ? "Métronidazole" : "Amoxicilline + acide clavulanique", dose: i ? "15 mg/kg IV lente" : "12,5 mg/kg", route: i ? "Intraveineuse" : "Voie orale", slots: ["08:00", "20:00"], startDate: start, days: 5, vetId: h.vetId, responsibleId: u("u-asst1"), instructions: "Noter toute intolérance digestive.", status: "actif", evolution: [], createdAt: `${start}T09:00` };
      const base2: Omit<TreatmentCourse, "doses"> = { id: `trt-h${i}b`, code: code(), patientId: h.patientId, clientId: h.clientId, setting: "hospitalisation", hospitalizationId: h.id, label: "Méloxicam", dose: "0,1 mg/kg", route: "Sous-cutanée", slots: ["08:00"], startDate: start, days: 3, vetId: h.vetId, responsibleId: u("u-asst2"), status: "actif", evolution: [], createdAt: `${start}T09:00` };
      const last1 = (day: string, slot: string) => day === today && slot === "08:00" && i === 0;
      treatments.push(
        { ...base1, doses: doses(base1, "equipe", [u("u-asst1"), u("u-asst2")], (day, slot) => (last1(day, slot) ? "none" : "donne")), evolution: start < today ? [{ id: `evo-h${i}1`, date: `${addDay(start, 1)}T18:00`, trend: "amelioration", text: "Appétit en reprise, température normalisée.", source: "clinique", userId: h.vetId }] : [] },
        { ...base2, doses: doses(base2, "equipe", [u("u-asst2")], () => "donne"), evolution: [] },
      );
    });
    const pets = db.patients.filter((p) => p.vitalStatus === "vivant" && !p.archived && PET.includes(p.species)).slice(2, 6);
    const homeDefs: [string, string, string, number, number, (day: string, slot: string, k: number) => DoseLog["status"] | "none", TreatmentCourse["evolution"][number]["trend"], string][] = [
      ["Amoxicilline", "1 comprimé 250 mg", "Voie orale", 7, -3, (_d, _s, k) => (k === 3 ? "manque" : "donne"), "amelioration", "Le chien mange mieux, plaie propre (photo reçue sur WhatsApp)."],
      ["Prednisolone", "½ comprimé 5 mg", "Voie orale", 10, -5, (d) => (d >= addDay(today, -2) ? "none" : "donne"), "stable", "Démangeaisons un peu moins fortes selon la propriétaire."],
      ["Gouttes auriculaires", "5 gouttes / oreille", "Auriculaire", 7, -2, (_d, _s, k) => (k === 1 ? "refuse" : "donne"), "aggravation", "Oreille plus rouge, le chat se gratte : contrôle proposé."],
      ["Métronidazole", "1 comprimé 250 mg", "Voie orale", 5, -1, () => "donne", "amelioration", "Selles moulées depuis hier."],
    ];
    pets.forEach((p, i) => {
      const [label, dose, route, days, off, rule, trend, text] = homeDefs[i];
      const start = addDay(today, off);
      const base: Omit<TreatmentCourse, "doses"> = { id: `trt-d${i}`, code: code(), patientId: p.id, clientId: p.ownerId, setting: "domicile", label, dose, route, slots: ["08:00", "20:00"], startDate: start, days, vetId: u(i % 2 ? "u-dg" : "u-vet1"), responsibleId: u("u-acc"), instructions: "Le propriétaire confirme chaque jour par WhatsApp ; appeler s'il ne donne pas de nouvelles.", status: "actif", evolution: [], createdAt: `${start}T10:00` };
      const ds = doses(base, "proprietaire", [u("u-acc")], rule);
      treatments.push({ ...base, doses: ds, evolution: i === 1 ? [] : [{ id: `evo-d${i}`, date: `${addDay(start, 1) > today ? today : addDay(start, 1)}T${addDay(start, 1) > today ? "07:30" : "19:00"}`, trend, text, source: "proprietaire", userId: u("u-acc") }] });
    });
  }

  /* ---- Personnel ---- */
  const leaves: LeaveRequest[] = db.leaves ?? [
    { id: "lv-1", userId: u("u-asst1"), kind: "conge", start: addDay(today, 8), end: addDay(today, 13), reason: "Congé annuel (famille au village).", status: "approuvee", requestedAt: `${addDay(today, -10)}T09:00`, decidedById: u("u-dg"), decidedAt: `${addDay(today, -9)}T10:00`, unavailabilityId: "una-lv-1" },
    { id: "lv-2", userId: u("u-vet2"), kind: "permission", start: addDay(today, 2), end: addDay(today, 2), hours: { from: "14:00", to: "17:00" }, reason: "Rendez-vous administratif.", status: "en_attente", requestedAt: `${addDay(today, -1)}T16:00` },
    { id: "lv-3", userId: u("u-acc"), kind: "maladie", start: addDay(today, -20), end: addDay(today, -18), reason: "Arrêt maladie (certificat remis).", status: "approuvee", requestedAt: `${addDay(today, -20)}T07:30`, decidedById: u("u-dg"), decidedAt: `${addDay(today, -20)}T08:00` },
    { id: "lv-4", userId: u("u-asst2"), kind: "conge", start: addDay(today, 30), end: addDay(today, 37), reason: "Congé de fin d'année.", status: "en_attente", requestedAt: `${today}T08:15` },
    { id: "lv-5", userId: u("u-vet1"), kind: "formation", start: addDay(today, -60), end: addDay(today, -58), reason: "Formation continue en échographie.", status: "approuvee", requestedAt: `${addDay(today, -80)}T09:00`, decidedById: u("u-dg"), decidedAt: `${addDay(today, -79)}T09:00` },
  ];
  const unavailabilities = [...db.unavailabilities];
  if (!db.leaves && !unavailabilities.some((x) => x.id === "una-lv-1")) unavailabilities.push({ id: "una-lv-1", userId: u("u-asst1"), start: `${addDay(today, 8)}T07:00`, end: `${addDay(today, 13)}T20:00`, reason: "Congé annuel" });
  const q = `T${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1} ${today.slice(0, 4)}`;
  const endQ = `${today.slice(0, 4)}-12-31`;
  const obj = (id: string, userId: string, title: string, metric: string, target: number, current: number, unit: string, dueDate: string, review: string): StaffObjective => ({ id, userId: u(userId), title, metric, target, current, unit, period: q, dueDate, status: current >= target ? "atteint" : "en_cours", reviews: [{ id: `${id}-r1`, date: `${addDay(today, -7)}T17:00`, byId: u(userId), text: review, value: current }], createdById: u("u-dg"), createdAt: `${addDay(today, -40)}T09:00` });
  const objectives: StaffObjective[] = db.objectives ?? [
    obj("obj-1", "u-acc", "Relancer les clients dans les délais (J+3, J+7…)", "Relances faites le jour prévu", 60, 41, "relances", endQ, "Bonne semaine, 3 relances en retard rattrapées."),
    obj("obj-2", "u-asst1", "Développer la vente au comptoir", "Ventes comptoir enregistrées", 150, 88, "ventes", endQ, "Les éleveurs de volaille reviennent plus souvent."),
    obj("obj-3", "u-vet2", "Visites de ferme planifiées et faites", "Visites avec rapport complet", 12, 9, "visites", endQ, "Deux visites reportées à cause de la pluie."),
    obj("obj-4", "u-asst2", "Observance en hospitalisation", "Prises cochées à l'heure", 95, 86, "%", addDay(today, 10), "Oublis surtout la nuit : rappel affiché en salle."),
    obj("obj-5", "u-vet1", "Comptes rendus de consultation validés sous 24 h", "Comptes rendus validés à temps", 40, 40, "comptes rendus", addDay(today, -5), "Objectif atteint."),
  ];

  return { ...db, schemaVersion: 11, farms, treatments, leaves, objectives, unavailabilities, counters: { ...db.counters, trt: Math.max(db.counters.trt ?? 0, n) } };
}
