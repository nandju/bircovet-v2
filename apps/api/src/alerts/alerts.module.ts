// Module de la tâche planifiée de scan d'alertes (côté serveur uniquement).
import { Module } from "@nestjs/common";
import { StateModule } from "../state/state.module";
import { AlertsScanService } from "./alerts-scan.service";

@Module({ imports: [StateModule], providers: [AlertsScanService] })
export class AlertsModule {}
