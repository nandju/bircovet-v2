// @CurrentUser() : injecte l'utilisateur authentifié dans un paramètre
// de méthode de contrôleur. La valeur vient du guard JWT (req.user).
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  accountId: string;
  clinicId: string;
  userId: string;
  roleId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
