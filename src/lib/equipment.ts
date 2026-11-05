import type { DemoDB, Equipment, EquipmentCondition } from "./types";

export const EQUIPMENT_CATEGORIES = ["Médical et chirurgie", "Imagerie", "Laboratoire", "Hospitalisation", "Mobilier", "Informatique et bureau", "Véhicule et terrain", "Froid (chaîne du froid)", "Autre"];

export const CONDITIONS: { value: EquipmentCondition; label: string; tone: string }[] = [
  { value: "neuf", label: "Neuf", tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  { value: "bon", label: "Bon état", tone: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  { value: "use", label: "Usé", tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  { value: "panne", label: "En panne", tone: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  { value: "reforme", label: "Réformé", tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
];

export const equipmentValue = (e: Pick<Equipment, "quantity" | "unitCost">) => (e.quantity || 0) * (e.unitCost || 0);

/** Totaux du matériel présent (hors réformé), par catégorie. */
export function equipmentTotals(db: DemoDB, est?: string) {
  const list = (db.equipment ?? []).filter((e) => (!est || e.establishmentId === est) && e.condition !== "reforme");
  const byCat = new Map<string, { count: number; value: number }>();
  for (const e of list) {
    const c = byCat.get(e.category) ?? { count: 0, value: 0 };
    c.count += e.quantity;
    c.value += equipmentValue(e);
    byCat.set(e.category, c);
  }
  return {
    total: list.reduce((s, e) => s + equipmentValue(e), 0),
    items: list.reduce((s, e) => s + e.quantity, 0),
    broken: list.filter((e) => e.condition === "panne").length,
    byCat: [...byCat.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.value - a.value),
  };
}
