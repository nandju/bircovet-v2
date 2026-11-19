// Module NestJS du point de santé /api/health.
import { Module } from "@nestjs/common";
import { StateModule } from "../state/state.module";
import { HealthController } from "./health.controller";

@Module({ imports: [StateModule], controllers: [HealthController] })
export class HealthModule {}
