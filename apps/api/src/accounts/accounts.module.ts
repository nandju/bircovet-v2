// Module de gestion des accès par le DG (POST /api/accounts*).
import { Module } from "@nestjs/common";
import { StateModule } from "../state/state.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({ imports: [StateModule], controllers: [AccountsController], providers: [AccountsService] })
export class AccountsModule {}
