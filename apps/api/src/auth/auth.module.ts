// Module d'authentification : contrôleur + service + guard JWT global
// (APP_GUARD = s'applique à TOUTES les routes de l'API, y compris health).
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { env } from "../config/env";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    // Signatures/lectures JWT (le secret est lu à l'usage dans le service/guard).
    JwtModule.register({ global: true }),
    // Stockage mémoire des compteurs anti-force brute (par IP).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
