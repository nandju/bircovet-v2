// Service NestJS qui encapsule le client Prisma.
// Prisma 7 n'embarque plus de moteur de requête interne : il passe par un
// « driver adapter ». Ici @prisma/adapter-neon = le driver serverless de Neon,
// connecté via DATABASE_URL (connexion pooled — voir prisma.config.ts).
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaNeon({ connectionString: env("DATABASE_URL") }) });
  }

  // Pas de $connect() au démarrage : l'adaptateur Neon se connecte à la
  // première requête. Ainsi l'API démarre même si la base est injoignable,
  // et c'est /api/health qui signale l'état réel de la connexion.

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
