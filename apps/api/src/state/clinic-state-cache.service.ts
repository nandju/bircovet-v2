// Cache mémoire de l'état des cliniques : Neon facture les OCTETS LUS, et
// l'état complet (clinic_states.data) pèse ~1 Mo de JSON par clinique.
//
// Principe : la seule vérité est le NUMÉRO DE VERSION, toujours relu en base
// (sous verrou FOR UPDATE pour les écritures). Le cache ne fournit data que
// quand sa version stockée égale la version fraîchement lue — sinon on lit
// data une fois et on met le cache à jour.
//
// Pourquoi c'est correct même avec plusieurs instances de l'API :
//  - une écriture sur une autre instance incrémente la version en base ;
//    la prochaine lecture relit la version → différente → cache ignoré ;
//  - dans la transaction, la version est relue VERROUILLÉE : elle ne peut
//    pas changer entre la lecture de la version et celle de data ;
//  - le cache n'est jamais muté en place : executeService/produce renvoie
//    toujours une NOUVELLE base (structuredClone), et set() remplace
//    l'entrée entière après écriture réussie.
// Compteur : chaque lecture complète de data est mesurée et journalisée
// (route GET /api/health/usage, réservée au DG).
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DemoDB } from "@cliva/core";
import type { Prisma, PrismaClient } from "../generated/prisma/client";

/** Fonctionne avec PrismaService comme avec le client d'une transaction. */
type Reader = Pick<PrismaClient, "clinicState" | "$queryRaw">;

@Injectable()
export class ClinicStateCache {
  private readonly log = new Logger(ClinicStateCache.name);
  private readonly startedAt = new Date();
  private readonly cache = new Map<string, { version: number; data: DemoDB }>();
  private dataBytesRead = 0;
  private fullDataReads = 0;

  /**
   * État pour une LECTURE simple (GET /api/state, contrôle pré-transaction).
   * La version est toujours relue ; data ne sort de Neon que si elle a changé.
   */
  async forRead(client: Reader, clinicId: string): Promise<{ version: number; data: DemoDB }> {
    const v = await client.clinicState.findUnique({
      where: { clinicId },
      select: { version: true },
    });
    if (!v) throw new NotFoundException("État de la clinique introuvable");
    const hit = this.cache.get(clinicId);
    if (hit && hit.version === v.version) return { version: v.version, data: hit.data };
    // Cache périmé ou absent : une seule lecture complète, étiquetée avec la
    // version RÉELLE de la ligne relue (elle a pu avancer entre les deux SELECT).
    const full = await client.clinicState.findUnique({
      where: { clinicId },
      select: { version: true, data: true },
    });
    if (!full) throw new NotFoundException("État de la clinique introuvable");
    const data = full.data as unknown as DemoDB;
    this.afterFullRead(clinicId, full.version, data);
    return { version: full.version, data };
  }

  /**
   * État VERROUILLÉ dans une transaction : `SELECT version ... FOR UPDATE`
   * sérialise les écritures, puis data vient du cache si la version est
   * identique (la ligne verrouillée ne peut pas changer entre les deux).
   */
  async forUpdate(
    client: Pick<Prisma.TransactionClient, "$queryRaw">,
    clinicId: string,
  ): Promise<{ version: number; data: DemoDB }> {
    const rows = await client.$queryRaw<{ version: number }[]>`
      SELECT version FROM clinic_states WHERE clinic_id = ${clinicId}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("État de la clinique introuvable");
    const hit = this.cache.get(clinicId);
    if (hit && hit.version === row.version) return { version: row.version, data: hit.data };
    const dataRows = await client.$queryRaw<{ data: DemoDB }[]>`
      SELECT data FROM clinic_states WHERE clinic_id = ${clinicId}::uuid
    `;
    const data = dataRows[0].data;
    this.afterFullRead(clinicId, row.version, data);
    return { version: row.version, data };
  }

  /** Après une écriture réussie : l'état écrit devient la référence du cache. */
  set(clinicId: string, version: number, data: DemoDB): void {
    this.cache.set(clinicId, { version, data });
  }

  /** Compteurs exposés par GET /api/health/usage. */
  usage() {
    return {
      since: this.startedAt.toISOString(),
      fullDataReads: this.fullDataReads,
      dataBytesRead: this.dataBytesRead,
      dataMbRead: Math.round((this.dataBytesRead / 1048576) * 100) / 100,
      cachedClinics: this.cache.size,
    };
  }

  private afterFullRead(clinicId: string, version: number, data: DemoDB): void {
    const bytes = Buffer.byteLength(JSON.stringify(data));
    this.dataBytesRead += bytes;
    this.fullDataReads += 1;
    this.cache.set(clinicId, { version, data });
    this.log.log(
      `lecture complète de clinic_states.data (${clinicId.slice(0, 8)}…, v${version}) ≈ ${Math.round(bytes / 1024)} Ko — cumul ${(this.dataBytesRead / 1048576).toFixed(2)} Mo`,
    );
  }
}
