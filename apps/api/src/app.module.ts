// Module racine de l'API : il assemble les modules fonctionnels.
// La preuve que @cliva/core (TypeScript source, non compilé) est bien
// importable depuis l'API : SCHEMA_VERSION vient du code métier partagé.
import { Module } from "@nestjs/common";
import { SCHEMA_VERSION } from "@cliva/core";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { StateModule } from "./state/state.module";
import { OpsModule } from "./ops/ops.module";
import { AccountsModule } from "./accounts/accounts.module";
import { AlertsModule } from "./alerts/alerts.module";

// Référencé ici pour que le bundler inclue réellement @cliva/core
// et que l'import soit testé au démarrage (affiché dans les logs).
export const CLIVA_SCHEMA_VERSION = SCHEMA_VERSION;

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, StateModule, OpsModule, AccountsModule, AlertsModule],
})
export class AppModule {}
