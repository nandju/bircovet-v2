// Logique métier de l'authentification.
// Principes : mots de passe et jetons de renouvellement stockés HACHÉS
// (Argon2 pour les mots de passe, SHA-256 pour les jetons aléatoires),
// messages d'erreur identiques quelle que soit la cause de l'échec.
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./current-user.decorator";

// Message unique : ne révèle jamais si l'email existe, si le mot de passe
// est faux, si le compte est inactif ou bloqué.
const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";

const MAX_FAILED_LOGINS = 5; // tentatives avant blocage
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes de blocage
const ACCESS_TOKEN_TTL = "15m"; // durée de vie du jeton d'accès
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export const REFRESH_COOKIE = "cliva_refresh";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  // @Inject() explicite : tsx/esbuild n'émettent pas les métadonnées
  // de types nécessaires à l'injection automatique par Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  /** Connexion : vérifie email/mot de passe avec anti-blocage et anti-force brute. */
  async login(email: string, password: string): Promise<LoginResult> {
    // findUnique par email — mais on ne révèle jamais « email inconnu ».
    const account = await this.prisma.account.findUnique({ where: { email } });

    // Compte inexistant : même réponse qu'un mauvais mot de passe.
    if (!account) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // Compte bloqué temporairement (trop d'échecs) : refus identique.
    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Compte désactivé par un administrateur : refus identique.
    if (!account.active) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const passwordOk = await verify(account.passwordHash, password);
    if (!passwordOk) {
      const failedLogins = account.failedLogins + 1;
      // Au 5e échec : blocage du compte pendant 15 minutes.
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          failedLogins,
          lockedUntil: failedLogins >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Succès : remise à zéro du compteur d'échecs et du blocage.
    await this.prisma.account.update({
      where: { id: account.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    return this.issueTokens(account.id, account.clinicId, account.userId, account.roleId, account.mustChangePassword);
  }

  /** Génère le couple jeton d'accès (JWT 15 min) + jeton de renouvellement (30 j). */
  private async issueTokens(
    accountId: string,
    clinicId: string,
    userId: string,
    roleId: string,
    mustChangePassword: boolean,
  ): Promise<LoginResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: accountId, clinicId, userId, roleId },
      { secret: env("JWT_SECRET"), expiresIn: ACCESS_TOKEN_TTL },
    );

    // Jeton de renouvellement : valeur aléatoire opaque, seul son haché
    // SHA-256 est stocké en base (vol de la base ≠ jetons réutilisables).
    const refreshToken = randomBytes(48).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        accountId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken, mustChangePassword };
  }

  /** Renouvellement : vérifie le jeton, le RÉVOQUE et en émet un nouveau (rotation). */
  async refresh(refreshToken: string): Promise<LoginResult> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { account: true },
    });

    const valid =
      stored && !stored.revokedAt && stored.expiresAt.getTime() > Date.now() && stored.account.active;
    if (!valid) throw new UnauthorizedException("Session expirée, reconnectez-vous");

    // Rotation : l'ancien jeton devient immédiatement inutilisable.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { account } = stored;
    return this.issueTokens(account.id, account.clinicId, account.userId, account.roleId, account.mustChangePassword);
  }

  /** Déconnexion : révoque le jeton de renouvellement s'il existe. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Renvoie le compte SANS les champs sensibles (hash, secret TOTP). */
  async getProfile(accountId: string) {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const { passwordHash: _ph, totpSecret: _ts, ...safe } = account;
    return safe;
  }

  /** Changement de mot de passe : vérifie l'ancien, hache le nouveau,
   *  lève mustChangePassword et révoque toutes les sessions existantes. */
  async changePassword(user: AuthUser, oldPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: user.accountId } });
    if (!(await verify(account.passwordHash, oldPassword))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const passwordHash = await hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: account.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      // Sécurité : toutes les anciennes sessions sont invalidées.
      this.prisma.refreshToken.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
