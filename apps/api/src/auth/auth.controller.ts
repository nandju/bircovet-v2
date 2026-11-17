// Routes d'authentification. Préfixe global /api (main.ts) → /api/auth/*.
// login et refresh sont @Public() (pas de jeton d'accès exigé) ;
// me et change-password sont protégés par le guard JWT global.
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards, ValidationPipe } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, REFRESH_COOKIE } from "./auth.service";
import { ChangePasswordDto, LoginDto } from "./auth.dto";
import { CurrentUser, type AuthUser } from "./current-user.decorator";
import { Public } from "./public.decorator";

// Pipe explicite : sans métadonnées de types, le ValidationPipe global
// ne connaît pas le DTO attendu — on le précise ici (mêmes options).
const dtoPipe = (expectedType: new () => object) =>
  new ValidationPipe({ expectedType, whitelist: true, forbidNonWhitelisted: true, transform: true });

// Durée du cookie de renouvellement : 30 jours (idem jeton).
const REFRESH_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  // @Inject() explicite : tsx/esbuild n'émettent pas les métadonnées de types.
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Pose le jeton de renouvellement dans un cookie httpOnly (invisible en JS). */
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // HTTPS obligatoire en prod
      maxAge: REFRESH_COOKIE_MS,
      path: "/api/auth", // le cookie n'est envoyé qu'aux routes auth
    });
  }

  @Public()
  // Anti force brute par IP : 20 tentatives / minute maximum sur ce endpoint.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post("login")
  async login(@Body(dtoPipe(LoginDto)) dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, mustChangePassword } = await this.auth.login(
      dto.email,
      dto.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, mustChangePassword };
  }

  @Public() // le jeton d'accès peut être expiré : on prouve son identité par le cookie
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException("Session expirée, reconnectez-vous");
    const { accessToken, refreshToken, mustChangePassword } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, mustChangePassword };
  }

  @HttpCode(200)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.accountId);
  }

  @HttpCode(200)
  @Post("change-password")
  async changePassword(@CurrentUser() user: AuthUser, @Body(dtoPipe(ChangePasswordDto)) dto: ChangePasswordDto) {
    await this.auth.changePassword(user, dto.oldPassword, dto.newPassword);
    return { ok: true };
  }
}
