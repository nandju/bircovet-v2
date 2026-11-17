// Guard JWT enregistré GLOBALEMENT (APP_GUARD dans AuthModule) :
// toute route exige un jeton d'accès valide, SAUF celles marquées @Public()
// (health, login, refresh).
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { env } from "../config/env";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { AuthUser } from "./current-user.decorator";

interface AccessTokenPayload {
  sub: string;
  clinicId: string;
  userId: string;
  roleId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // NB : @Inject() explicite partout — tsx/esbuild n'émettent pas les
  // métadonnées de types (emitDecoratorMetadata) dont Nest a besoin
  // pour deviner les dépendances à partir des types TypeScript.
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Route publique ? → pas de vérification.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Jeton d'accès manquant");

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: env("JWT_SECRET"),
      });
      // Disponible ensuite via @CurrentUser() dans les contrôleurs.
      request.user = {
        accountId: payload.sub,
        clinicId: payload.clinicId,
        userId: payload.userId,
        roleId: payload.roleId,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Jeton d'accès invalide ou expiré");
    }
  }
}
