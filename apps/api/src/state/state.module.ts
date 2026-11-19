// Module de lecture de l'état clinique (GET /api/state[/version]).
// Le cache (ClinicStateCache) est exporté : OpsService l'utilise pour ne pas
// relire ~1 Mo de JSON à chaque opération, HealthModule pour /health/usage.
import { Module } from "@nestjs/common";
import { ClinicStateCache } from "./clinic-state-cache.service";
import { StateController } from "./state.controller";

@Module({ controllers: [StateController], providers: [ClinicStateCache], exports: [ClinicStateCache] })
export class StateModule {}
