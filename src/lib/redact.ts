/**
 * Filtrage des données sensibles avant envoi à un navigateur (cf. docs/AUDIT.md §3.3).
 * Fonction PURE utilisée côté serveur par GET /api/state : elle ne lit que
 * (db, user) et ne dépend d'aucun état global ni du navigateur.
 *
 * Règles :
 *  - `platform` (console éditeur : finances de toutes les cliniques) n'est
 *    JAMAIS envoyé à une clinique ;
 *  - tout champ `demoPassword` est retiré, récursivement ;
 *  - les données « salaires et résultats confidentiels » ne sont envoyées
 *    qu'aux rôles autorisés par la matrice (dg toujours ; comptable si le DG
 *    lui a ouvert le module `salaires` dans les réglages) — cf. canWith ;
 *  - un confrère référent ne reçoit que les dossiers explicitement partagés
 *    (sharedPatientIds).
 */
import { canWith } from "./permissions";
import type { DemoDB, User } from "./types";

/** Supprime récursivement toutes les clés `demoPassword` d'une valeur JSON. */
export function stripDemoPasswords<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripDemoPasswords) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "demoPassword") continue;
      out[key] = stripDemoPasswords(v);
    }
    return out as T;
  }
  return value;
}

/** Copie de l'état filtrée pour le rôle de `user` (l'original n'est pas muté). */
export function redactForRole(db: DemoDB, user: User): DemoDB {
  let out: DemoDB = stripDemoPasswords(db);

  // Données financières confidentielles : collection `salaries` (salaires et
  // charges) et `budgets` (résultats chiffrés validés par le DG). Les marges
  // et résultats consolidés sont RECALCULÉS par les écrans à partir des
  // factures/paiements/dépenses — qui ne peuvent pas être retirés sans casser
  // les modules facturation/finances ; leur accès reste couvert par la
  // matrice de permissions (modules rapports/finances).
  const canSeeConfidential = canWith(db.settings?.permissions, user.roleId, "salaires", "read");
  if (!canSeeConfidential) {
    const clone: Partial<DemoDB> = { ...out };
    delete clone.salaries;
    delete clone.budgets;
    out = clone as DemoDB;
  }

  // Console éditeur : jamais envoyée à un compte de clinique.
  const clone: Partial<DemoDB> = { ...out };
  delete clone.platform;
  out = clone as DemoDB;

  // Confrère référent : uniquement les dossiers partagés avec lui.
  if (user.roleId === "confrere") {
    const shared = new Set(user.sharedPatientIds ?? []);
    out = { ...out, patients: out.patients.filter((p) => shared.has(p.id)) };
  }

  return out;
}
