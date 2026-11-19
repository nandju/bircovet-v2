// Script de seed : `pnpm --filter api seed`.
// Il est IDEMPOTENT : on peut le relancer, il ne crée jamais de doublons
// (upsert sur la clinique, l'état et chaque compte).
//
// Ce qu'il fait :
//   1. crée (ou retrouve) la clinique « BIRCOVET (test) » ;
//   2. génère l'état métier de démonstration via createSeed() de @cliva/core,
//      en supprimant les champs demoPassword (donnée publique de la démo,
//      qui n'a rien à faire en base) ;
//   3. enregistre cet état dans ClinicState.data ;
//   4. crée un Account par utilisateur du seed (mot de passe = SEED_PASSWORD,
//      haché Argon2, changement obligatoire à la première connexion).
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaNeon } from "@prisma/adapter-neon";
import { createSeed, SCHEMA_VERSION, stripDemoPasswords, type DemoDB, type User } from "@cliva/core";
import { PrismaClient } from "../src/generated/prisma/client";

// UUID fixe : le seed retrouve toujours la même clinique de test.
const SEED_CLINIC_ID = "00000000-0000-4000-8000-000000000001";
const SEED_CLINIC_NAME = "BIRCOVET (test)";

const REQUIRED = ["DATABASE_URL", "SEED_PASSWORD"] as const;

async function main(): Promise<void> {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(", ")}`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL as string }),
  });

  try {
    // 1) Clinique de test.
    const clinic = await prisma.clinic.upsert({
      where: { id: SEED_CLINIC_ID },
      update: {},
      create: {
        id: SEED_CLINIC_ID,
        name: SEED_CLINIC_NAME,
        country: "CI",
        licenseStatus: "trial",
      },
    });
    console.log(`Clinique : ${clinic.name}`);

    // 2) État métier complet (DemoDB) sans les mots de passe de démo.
    const db: DemoDB = stripDemoPasswords(createSeed(new Date()));
    await prisma.clinicState.upsert({
      where: { clinicId: clinic.id },
      // version+1 à chaque réécriture : le cache en mémoire de l'API se base
      // sur la version pour savoir si data a changé — un re-seed doit
      // invalider l'état en cache d'une API qui tourne.
      update: { data: db as object, schemaVersion: SCHEMA_VERSION, version: { increment: 1 } },
      create: {
        clinicId: clinic.id,
        version: 1,
        schemaVersion: SCHEMA_VERSION,
        data: db as object,
      },
    });
    console.log(`État de la clinique enregistré (schéma v${SCHEMA_VERSION}).`);

    // 3) Un compte par utilisateur du seed.
    //    Le hash Argon2 est calculé UNE fois : tous les comptes partagent
    //    le même mot de passe initial (SEED_PASSWORD).
    //    db.platform.editor n'est PAS comptabilisé : l'éditeur plateforme
    //    (console multi-cliniques, hors MVP) n'est jamais utilisé dans les
    //    tests ni par la clinique — un compte inutile serait une surface
    //    d'attaque de plus.
    const passwordHash = await hash(process.env.SEED_PASSWORD as string);
    const users = (createSeed(new Date()).users ?? []) as User[];
    for (const user of users) {
      await prisma.account.upsert({
        where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
        update: { roleId: user.roleId, active: user.active },
        create: {
          clinicId: clinic.id,
          userId: user.id,
          email: user.email,
          passwordHash,
          roleId: user.roleId,
          active: user.active,
          mustChangePassword: true,
        },
      });
    }
    console.log(`${users.length} compte(s) créé(s) ou mis à jour (mot de passe = SEED_PASSWORD, à changer à la 1re connexion).`);
    console.log("Seed terminé.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Échec du seed :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
