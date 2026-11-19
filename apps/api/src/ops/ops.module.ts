// Module des opérations métier (POST /api/ops).
import { Module } from "@nestjs/common";
import { StateModule } from "../state/state.module";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";

@Module({ imports: [StateModule], controllers: [OpsController], providers: [OpsService] })
export class OpsModule {}
