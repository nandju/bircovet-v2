// File d'attente persistante des opérations en cours d'envoi (mode connecté).
// Stockage : IndexedDB natif (aucune dépendance). UNE file PAR COMPTE
// (clé = accountId du jeton) : un autre utilisateur qui se connecte sur le
// même navigateur ne rejoue jamais les opérations d'un compte différent.
// Toute erreur IndexedDB est absorbée : la persistance ne doit jamais
// casser l'envoi normal.
import type { PendingOp } from "./api";

const DB_NAME = "cliva-api";
const DB_VERSION = 1;
const STORE = "opQueue";

const available = (): boolean => typeof indexedDB !== "undefined";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const key = (accountId: string): string => `opq:${accountId}`;

const isPendingOp = (o: unknown): o is PendingOp =>
  !!o && typeof o === "object" &&
  typeof (o as PendingOp).opKey === "string" &&
  typeof (o as PendingOp).name === "string" &&
  typeof (o as PendingOp).clientNow === "string";

/** Opérations en attente d'envoi pour CE compte (ordre conservé). */
export async function loadPendingOps(accountId: string): Promise<PendingOp[]> {
  if (!available()) return [];
  try {
    const idb = await openDb();
    const ops = await request<unknown>(idb.transaction(STORE, "readonly").objectStore(STORE).get(key(accountId)));
    idb.close();
    return Array.isArray(ops) ? ops.filter(isPendingOp) : [];
  } catch {
    return [];
  }
}

/** Remplace la file persistée du compte (appelé à chaque ajout/retrait). */
export async function savePendingOps(accountId: string, ops: PendingOp[]): Promise<void> {
  if (!available()) return;
  try {
    const idb = await openDb();
    const store = idb.transaction(STORE, "readwrite").objectStore(STORE);
    if (ops.length === 0) store.delete(key(accountId));
    else store.put(ops, key(accountId));
    await new Promise<void>((resolve, reject) => {
      const tx = store.transaction;
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    idb.close();
  } catch {
    /* IndexedDB indisponible : la file reste en mémoire pour cette session */
  }
}
