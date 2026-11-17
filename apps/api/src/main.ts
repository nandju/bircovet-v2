// Point d'entrée de l'API NestJS : c'est ce fichier que lance `pnpm dev:api`.
// Ordre : 1) valider les variables d'environnement (refus de démarrer sinon),
// 2) créer l'application, 3) appliquer la config commune (app.setup.ts),
// 4) écouter sur le port 3001.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule, CLIVA_SCHEMA_VERSION } from "./app.module";
import { configureApp } from "./app.setup";
import { validateEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  // Bloque le démarrage si une variable d'environnement obligatoire manque.
  validateEnv();

  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = 3001;
  await app.listen(port);
  console.log(`API Cliva démarrée sur http://localhost:${port}/api (schéma métier v${CLIVA_SCHEMA_VERSION})`);
}

void bootstrap();
