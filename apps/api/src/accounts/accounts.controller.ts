// Routes de gestion des accès — réservées au DG (vérifié par canWith dans
// le service, sur le module « admin » de la matrice de permissions).
// Préfixe global /api → /api/accounts/*.
import { Body, Controller, HttpCode, Inject, Param, Post, ValidationPipe } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { AccountsService, type CreateAccountResponse } from "./accounts.service";
import { CreateAccountDto, ResetPasswordDto } from "./accounts.dto";

// Pipe explicite (tsx n'émet pas les métadonnées de types).
const dtoPipe = (expectedType: new () => object) =>
  new ValidationPipe({ expectedType, whitelist: true, forbidNonWhitelisted: true, transform: true });

@Controller("accounts")
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  /** Crée un utilisateur + son accès (mot de passe temporaire à changer). */
  @HttpCode(200)
  @Post()
  create(
    @CurrentUser() auth: AuthUser,
    @Body(dtoPipe(CreateAccountDto)) dto: CreateAccountDto,
  ): Promise<CreateAccountResponse> {
    return this.accounts.create(auth, dto);
  }

  /** Réinitialise le mot de passe d'un accès et révoque ses sessions. */
  @HttpCode(200)
  @Post(":userId/reset-password")
  resetPassword(
    @CurrentUser() auth: AuthUser,
    @Param("userId") userId: string,
    @Body(dtoPipe(ResetPasswordDto)) dto: ResetPasswordDto,
  ): Promise<{ ok: true }> {
    return this.accounts.resetPassword(auth, userId, dto);
  }
}
