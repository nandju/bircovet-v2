/**
 * Couleurs d'univers Cliva : une teinte par grand domaine, partout dans l'app
 * (onglets du tableau de bord, groupes du menu, agenda, rapports).
 */
export type Universe = "pilotage" | "agenda" | "clinique" | "rural" | "gestion" | "relation" | "administration";

export const UNIVERSE: Record<string, { dot: string; text: string; bar: string; soft: string }> = {
  agenda: { dot: "bg-theme-purple-500", text: "text-theme-purple-500", bar: "bg-theme-purple-500", soft: "bg-gray-50 dark:bg-white/5" },
  clientele: { dot: "bg-theme-pink-500", text: "text-theme-pink-500", bar: "bg-theme-pink-500", soft: "bg-gray-50 dark:bg-white/5" },
  clinique: { dot: "bg-brand-500", text: "text-brand-700 dark:text-brand-300", bar: "bg-brand-500", soft: "bg-brand-50 dark:bg-brand-500/10" },
  prevention: { dot: "bg-blue-light-500", text: "text-blue-light-700 dark:text-blue-light-300", bar: "bg-blue-light-500", soft: "bg-blue-light-50 dark:bg-blue-light-500/10" },
  rural: { dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500", soft: "bg-orange-50 dark:bg-orange-500/10" },
  gestion: { dot: "bg-tertiary-500", text: "text-tertiary-700 dark:text-tertiary-300", bar: "bg-tertiary-500", soft: "bg-tertiary-50 dark:bg-tertiary-500/10" },
  relation: { dot: "bg-theme-pink-500", text: "text-theme-pink-500", bar: "bg-theme-pink-500", soft: "bg-gray-50 dark:bg-white/5" },
  pilotage: { dot: "bg-gray-400", text: "text-gray-700 dark:text-gray-300", bar: "bg-gray-400", soft: "bg-gray-50 dark:bg-white/5" },
  administration: { dot: "bg-gray-400", text: "text-gray-700 dark:text-gray-300", bar: "bg-gray-400", soft: "bg-gray-50 dark:bg-white/5" },
};
export const universe = (k: string) => UNIVERSE[k] ?? UNIVERSE.pilotage;
