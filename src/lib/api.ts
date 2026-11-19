/**
 * Client HTTP du mode connecté (API NestJS).
 * - Activé uniquement si NEXT_PUBLIC_API_URL est définie (sinon : démo localStorage).
 * - Le jeton d'accès est gardé EN MÉMOIRE uniquement (jamais localStorage) ;
 *   le jeton de renouvellement vit dans un cookie httpOnly géré par l'API.
 * - Sur une réponse 401 : renouvellement via /auth/refresh puis UNE SEULE
 *   nouvelle tentative.
 */
import type { DemoDB, User } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
/** true = mode connecté (API) ; false = mode démo localStorage actuel. */
export const apiMode = API_URL.length > 0;

/* ---------- Jeton d'accès (mémoire seulement) ---------- */
let accessToken: string | null = null;
export const clearAccessToken = () => {
  accessToken = null;
};

/* ---------- Renouvellement (une seule requête à la fois) ---------- */
let refreshing: Promise<boolean> | null = null;

/** Tente de renouveler le jeton d'accès via le cookie httpOnly. */
export function apiRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      const body = (await res.json()) as { accessToken?: string };
      accessToken = body.accessToken ?? null;
      return !!accessToken;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Erreur réseau (serveur injoignable) — à distinguer d'un refus métier. */
export class ApiNetworkError extends Error {}
/** Réponse HTTP non-2xx (refus, validation, droits…). */
export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch authentifié : cookie inclus, jeton en mémoire, retry unique après 401. */
export async function apiFetch<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiNetworkError("Serveur injoignable");
  }
  if (res.status === 401 && retry) {
    // Jeton expiré : on le renouvelle puis on réessaie UNE fois.
    if (await apiRefresh()) return apiFetch<T>(path, init, false);
  }
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(" · ") : (body.message ?? message);
    } catch {
      /* corps non JSON : message par défaut */
    }
    throw new ApiHttpError(res.status, message);
  }
  return (await res.json()) as T;
}

/* ---------- Appels typés ---------- */

export interface ApiAccount {
  id: string;
  clinicId: string;
  userId: string;
  email: string;
  roleId: string;
  active: boolean;
  mustChangePassword: boolean;
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: true; mustChangePassword: boolean } | { ok: false; error: string }> {
  try {
    const body = await apiFetch<{ accessToken: string; mustChangePassword: boolean }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false, // pas de refresh automatique sur un échec de connexion
    );
    accessToken = body.accessToken;
    return { ok: true, mustChangePassword: body.mustChangePassword };
  } catch (e) {
    if (e instanceof ApiNetworkError) return { ok: false, error: "Serveur injoignable. Vérifiez que l'API est démarrée." };
    return { ok: false, error: e instanceof Error ? e.message : "Connexion impossible." };
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* déconnexion locale malgré tout */
  }
  accessToken = null;
}

export const apiMe = () => apiFetch<ApiAccount>("/auth/me");
export const apiGetState = () => apiFetch<{ version: number; data: DemoDB }>("/state");
export const apiGetVersion = () => apiFetch<{ version: number }>("/state/version");
export const apiChangePassword = (oldPassword: string, newPassword: string) =>
  apiFetch<{ ok: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword }),
  });

/* ---------- Gestion des accès (DG) ---------- */

/** Mêmes champs que l'input de l'opération « admin.utilisateur.creer ». */
export type AccountUserInput = Pick<User, "name" | "email" | "roleId" | "establishmentId" | "title" | "phone">;

export interface CreateAccountResponse {
  ok: boolean;
  userId?: string;
  version?: number;
  error?: string;
}

/** Crée l'utilisateur ET son accès en une transaction côté serveur. */
export const apiCreateAccount = (user: AccountUserInput, email: string, temporaryPassword: string) =>
  apiFetch<CreateAccountResponse>("/accounts", {
    method: "POST",
    body: JSON.stringify({ user, email, temporaryPassword }),
  });

/** Nouveau mot de passe temporaire + sessions du compte révoquées. */
export const apiResetPassword = (userId: string, temporaryPassword: string) =>
  apiFetch<{ ok: boolean }>(`/accounts/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ temporaryPassword }),
  });

/* ---------- Envoi des opérations ---------- */

export interface PendingOp {
  opKey: string;
  name: string;
  input: unknown;
  clientNow: string;
}

export interface OpResponse {
  ok: boolean;
  version?: number;
  message?: string;
  data?: unknown;
  error?: string;
  replayed?: boolean;
}

export const apiPostOp = (op: PendingOp) =>
  apiFetch<OpResponse>("/ops", { method: "POST", body: JSON.stringify(op) });
