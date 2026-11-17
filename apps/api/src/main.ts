// Point d'entrée de l'API NestJS : c'est ce fichier que lance `pnpm dev:api`.
// Ordre : 1) charger .env et valider les variables (refus de démarrer sinon),
// 2) créer l'application, 3) sécurité (helmet, CORS restreint, ValidationPipe),
// 4) préfixe global /api, 5) écouter sur le port 3001.
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule, CLIVA_SCHEMA_VERSION } from "./app.module";
import { env, validateEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  // Bloque le démarrage si une variable d'environnement obligatoire manque.
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // En-têtes HTTP de sécurité standards (XSS, clickjacking, etc.).
  app.use(helmet());

  // Seule l'origine du front est autorisée, cookies d'auth inclus.
  app.enableCors({ origin: env("CORS_ORIGIN"), credentials: true });

  // Validation/assainissement automatique des corps de requêtes (DTO).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Toutes les routes sont servies sous /api (ex. GET /api/health).
  app.setGlobalPrefix("api");

  const port = 3001;
  await app.listen(port);
  console.log(`API Cliva démarrée sur http://localhost:${port}/api (schéma métier v${CLIVA_SCHEMA_VERSION})`);
}

void bootstrap();
