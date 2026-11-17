// Configuration commune de l'application Express/Nest, factorisée pour être
// réutilisée telle quelle par les tests e2e (mêmes middlewares, mêmes règles).
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env";

export function configureApp(app: INestApplication): void {
  // En-têtes HTTP de sécurité standards.
  app.use(helmet());
  // Lecture des cookies (jeton de renouvellement httpOnly).
  app.use(cookieParser());
  // Seule l'origine du front est autorisée, cookies d'auth inclus.
  app.enableCors({ origin: env("CORS_ORIGIN"), credentials: true });
  // Validation/assainissement automatique des corps de requêtes (DTO).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Toutes les routes sous /api (ex. GET /api/health, POST /api/auth/login).
  app.setGlobalPrefix("api");
}
