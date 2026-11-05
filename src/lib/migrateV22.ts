/**
 * Schéma v22 : index thérapeutique propre à la clinique (vide au départ, rempli par import ou saisie).
 */
import type { DemoDB } from "./types";

export function migrateToV22(db: DemoDB): DemoDB {
  return { ...db, schemaVersion: 22, drugIndex: db.drugIndex ?? { entries: [], sources: [] } };
}
