// Module de lecture de l'état clinique (GET /api/state[/version]).
import { Module } from "@nestjs/common";
import { StateController } from "./state.controller";

@Module({ controllers: [StateController] })
export class StateModule {}
