// POST /api/ops : point d'entrée unique des mutations métier.
// clinicId et userId viennent UNIQUEMENT du jeton (@CurrentUser) — un client
// ne peut jamais jouer une opération pour une autre clinique ou un autre rôle.
import { Body, Controller, HttpCode, Inject, Post, ValidationPipe } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { OpDto } from "./ops.dto";
import { OpsService, type OpResponse } from "./ops.service";

const dtoPipe = new ValidationPipe({
  expectedType: OpDto,
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@Controller("ops")
export class OpsController {
  constructor(@Inject(OpsService) private readonly ops: OpsService) {}

  @HttpCode(200)
  @Post()
  async execute(@CurrentUser() auth: AuthUser, @Body(dtoPipe) dto: OpDto): Promise<OpResponse> {
    return this.ops.execute(auth, dto);
  }
}
