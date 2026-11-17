// Configuration du CLI Prisma (version 7) — documentation officielle Neon :
// les commandes `prisma migrate ...` doivent utiliser la connexion DIRECTE
// (sans le pooler PgBouncer), tandis que l'application utilise DATABASE_URL
// (connexion « pooled ») via l'adaptateur @prisma/adapter-neon.
// Prisma 7 ne charge pas .env tout seul : d'où l'import "dotenv/config".
import "dotenv/config";
import { defineConfig } from "prisma/config";

// NB : on lit process.env DIRECTEMENT (et non le helper env() de prisma/config)
// car env() interdit les valeurs vides, ce qui bloquerait même les commandes
// hors-ligne (`generate`, `migrate diff`) tant que .env n'est pas rempli.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
