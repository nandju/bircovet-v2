// Module des opérations métier (POST /api/ops).
import { Module } from "@nestjs/common";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";

@Module({ controllers: [OpsController], providers: [OpsService] })
export class OpsModule {}
