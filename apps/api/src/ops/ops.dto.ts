// Corps de POST /api/ops, validé par le pipe explicite du contrôleur.
import { IsDateString, IsDefined, IsString, IsUUID } from "class-validator";

export class OpDto {
  /** Clé d'idempotence : une opKey déjà traitée ne se réexécute jamais. */
  @IsUUID()
  opKey!: string;

  /** Nom de l'opération dans le registre OPERATIONS (@cliva/core). */
  @IsString()
  name!: string;

  /** Données d'entrée de l'opération (JSON quelconque, validé par le service métier). */
  @IsDefined()
  input!: unknown;

  /** Horodatage côté client (traçabilité : l'heure serveur est enregistrée à part). */
  @IsDateString()
  clientNow!: string;
}
