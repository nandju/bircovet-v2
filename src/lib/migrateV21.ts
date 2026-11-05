/**
 * Schéma v21 : programmes de prophylaxie (modèles et programmes appliqués).
 */
import { lotHeadcount } from "./care";
import { speciesOf } from "./farmProfile";
import { addDays, uid } from "./format";
import { defaultPrograms, PROPHY_KIND, scheduleSteps, startsAtOne } from "./prophylaxis";
import { DEFAULT_TUTORIALS } from "./tutorials";
import type { DemoDB, ProphylaxisPlan, ProphylaxisProgram } from "./types";

export function migrateToV21(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.prophylaxisPrograms) return { ...db, schemaVersion: 21 };
  const programs = defaultPrograms(today);
  const vet = db.users.find((u) => u.roleId === "vet" && u.active)?.id ?? db.users[0].id;
  const farms = structuredClone(db.farms);
  const patients = structuredClone(db.patients);
  const plans: ProphylaxisPlan[] = [];
  let n = 0;
  const apply = (pg: ProphylaxisProgram, start: string, base: Omit<ProphylaxisPlan, "id" | "code" | "programId" | "name" | "species" | "startDate" | "startLabel" | "steps" | "status" | "vetId" | "createdAt" | "createdById"> & { species?: string }) => {
    const offset = startsAtOne(pg.steps) ? 1 : 0;
    const steps = scheduleSteps(pg.steps, start, offset).map((s) => ({ ...s, id: uid("pps"), status: "a_faire" as const }));
    const plan: ProphylaxisPlan = { id: `ppl-${++n}`, code: `PPX-${String(n).padStart(4, "0")}`, programId: pg.id, name: pg.name, species: base.species ?? pg.species, startDate: start, startLabel: pg.startLabel, steps, status: "en_cours", vetId: vet, createdAt: start, createdById: vet, ...base };
    // Les actions passées depuis plus de 2 jours sont notées faites (sauf une, laissée en retard pour l'exemple).
    let leftLate = false;
    for (const s of plan.steps) {
      if (s.dueDate >= addDays(today, -1)) continue;
      if (!leftLate && s.dueDate >= addDays(today, -6)) { leftLate = true; continue; }
      s.status = "fait";
      s.doneDate = s.dueDate;
      s.doneById = vet;
      if (plan.target === "patient") {
        const pt = patients.find((x) => x.id === plan.patientId);
        if (pt && s.kind === "vaccination") {
          s.logId = uid("vac");
          pt.vaccinations.unshift({ id: s.logId, name: s.label, date: s.dueDate, nextDue: plan.steps.find((x) => x.kind === "vaccination" && x.dueDate > s.dueDate)?.dueDate, authorId: vet });
        }
      } else {
        const f = farms.find((x) => x.id === plan.farmId);
        if (f) {
          f.interventions = f.interventions ?? [];
          s.logId = uid("fint");
          f.interventions.unshift({ id: s.logId, date: s.dueDate, kind: PROPHY_KIND[s.kind].farmKind, species: plan.species, lotId: plan.lotId, count: plan.count ?? 1, product: s.product, note: `${plan.code} · ${s.label}`, byId: vet });
        }
      }
    }
    plans.push(plan);
  };
  // Une bande de poulets de chair démarrée il y a 12 jours.
  for (const f of farms) {
    const lot = f.lots.find((l) => l.status === "actif" && speciesOf(l.species) === "Volaille");
    if (!lot) continue;
    apply(programs[0], addDays(today, -12), { target: "lot", farmId: f.id, lotId: lot.id, count: lotHeadcount(f, lot.id) || undefined, species: "Volaille" });
    break;
  }
  // Un troupeau de bovins sur le programme annuel, démarré il y a 20 jours.
  for (const f of farms) {
    const lot = f.lots.find((l) => l.status === "actif" && speciesOf(l.species) === "Bovin");
    if (!lot) continue;
    apply(programs[4], addDays(today, -20), { target: "cheptel", farmId: f.id, count: f.lots.filter((l) => l.status === "actif" && speciesOf(l.species) === "Bovin").reduce((s, l) => s + lotHeadcount(f, l.id), 0) || undefined, species: "Bovin" });
    break;
  }
  // Un chiot : le programme démarre à sa naissance (né il y a environ 10 semaines).
  const dog = patients.find((p) => p.species === "Chien" && p.vitalStatus === "vivant" && !p.archived);
  if (dog) apply(programs[2], addDays(today, -68), { target: "patient", patientId: dog.id, count: 1, species: "Chien", note: `Exemple de démonstration : dates calculées comme si ${dog.name} était né il y a 10 semaines.` });
  const tutorials = db.tutorials ? [...db.tutorials, ...DEFAULT_TUTORIALS.filter((t) => !db.tutorials!.some((x) => x.id === t.id))] : db.tutorials;
  return { ...db, schemaVersion: 21, farms, patients, tutorials, prophylaxisPrograms: programs, prophylaxisPlans: plans, counters: { ...db.counters, prophyProgram: programs.length, prophyPlan: n } };
}
