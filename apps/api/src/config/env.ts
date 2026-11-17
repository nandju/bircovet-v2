// Chargement et validation des variables d'environnement.
// L'API REFUSE de démarrer s'il manque une variable obligatoire :
// c'est le but de `validateEnv()`, appelé tout au début de main.ts.
import "dotenv/config";

// Liste unique des variables exigées : ajouter ici toute nouvelle variable.
const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_URL_TEST",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "CORS_ORIGIN",
  "SEED_PASSWORD",
] as const;

export type EnvName = (typeof REQUIRED)[number];

/** Vérifie que chaque variable obligatoire est définie et non vide. */
export function validateEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    // On n'affiche jamais les VALEURS, seulement les noms manquants.
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(", ")}. ` +
        `Remplissez apps/api/.env (voir .env.example).`,
    );
  }
}

/** Lit une variable validée (à appeler après validateEnv()). */
export function env(name: EnvName): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement absente : ${name}`);
  return value;
}
