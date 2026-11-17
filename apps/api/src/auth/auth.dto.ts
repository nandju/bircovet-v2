// Corps de requêtes du module auth, validés par le ValidationPipe global
// (whitelist: les champs inconnus sont rejetés).
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  // Politique demandée : 10 caractères minimum.
  @IsString()
  @MinLength(10)
  newPassword!: string;
}
