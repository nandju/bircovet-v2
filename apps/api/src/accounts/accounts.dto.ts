// Corps de requêtes du module accounts, validés par les pipes explicites
// du contrôleur (même convention que auth/ops : expectedType + whitelist).
import { Type } from "class-transformer";
import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength, ValidateNested } from "class-validator";

/** Mêmes champs que l'input de l'opération « admin.utilisateur.creer » (UserInput du métier). */
export class AccountUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  // Rôles applicatifs du métier — l'éditeur plateforme n'est jamais créable ici.
  @IsIn(["dg", "vet", "assistant", "accueil", "comptable", "confrere"])
  roleId!: string;

  @IsString()
  @IsNotEmpty()
  establishmentId!: string;

  @IsString()
  title!: string;

  @IsString()
  phone!: string;
}

/** POST /api/accounts — création d'un utilisateur + de son accès en une transaction. */
export class CreateAccountDto {
  @ValidateNested()
  @Type(() => AccountUserDto)
  user!: AccountUserDto;

  /** E-mail de connexion du compte (unique dans toute la base). */
  @IsEmail()
  email!: string;

  /** Mot de passe temporaire : 10 caractères minimum (politique du dépôt). */
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;
}

/** POST /api/accounts/:userId/reset-password — nouveau mot de passe temporaire. */
export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;
}
