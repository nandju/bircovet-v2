"use client";

/**
 * Magasin de données de DÉMONSTRATION (localStorage, versionné).
 * - aucune donnée réelle, aucun mot de passe réel ;
 * - accès à localStorage uniquement côté client (après montage) ;
 * - données absentes / corrompues / d'une ancienne version → jeu initial restauré.
 * MODE CONNECTÉ (API) : si NEXT_PUBLIC_API_URL est définie, ce magasin
 * bascule sur l'API NestJS — exécution locale optimiste inchangée, puis envoi
 * de chaque opération à POST /api/ops (file ordonnée, idempotente par opKey)
 * et rechargement de l'état validé par le serveur. Sans cette variable,
 * le mode démo localStorage reste strictement identique.
 */
import { useToast } from "@/context/ToastContext";
import { LogoMark } from "@/icons";
import ChangePasswordScreen from "@/components/auth/ChangePasswordScreen";
import {
  apiMode, apiLogin, apiLogout, apiMe, apiGetState, apiGetVersion, apiPostOp, apiRefresh,
  ApiNetworkError, clearAccessToken, type PendingOp,
} from "@/lib/api";
import { OPERATIONS } from "@/lib/services/registry";
import { isoLocal } from "@/lib/format";
import { applyRoleSettings, can as canRole, type ModuleId, type PermAction } from "@/lib/permissions";
import { applyCategoryList, applyLabelOverrides } from "@/lib/labels";
import { migrateToV6 } from "@/lib/followup";
import { migrateToV8 } from "@/lib/pharma/state";
import { migrateToV9 } from "@/lib/clientActivity";
import { migrateToV10 } from "@/lib/announcements";
import { migrateToV11 } from "@/lib/migrateV11";
import { migrateToV12 } from "@/lib/migrateV12";
import { migrateToV13 } from "@/lib/migrateV13";
import { migrateToV14 } from "@/lib/migrateV14";
import { migrateToV15 } from "@/lib/migrateV15";
import { migrateToV16 } from "@/lib/migrateV16";
import { migrateToV17 } from "@/lib/migrateV17";
import { migrateToV18 } from "@/lib/migrateV18";
import { migrateToV19 } from "@/lib/migrateV19";
import { migrateToV20 } from "@/lib/migrateV20";
import { migrateToV21 } from "@/lib/migrateV21";
import { migrateToV22 } from "@/lib/migrateV22";
import { migrateToV23 } from "@/lib/migrateV23";
import { visibleTo } from "@/lib/notifications";
import { migrateToV7 } from "@/lib/rural";
import { SCHEMA_VERSION, createSeed } from "@/lib/seed";
import { executeService, refreshDerived, type Service } from "@/lib/services/core";
import type { ActionCtx, DemoDB, Establishment, ServiceResult, SessionState, User } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** Comptes de connexion : équipe de la clinique + compte éditeur de la plateforme. */
function accountsOf(db: DemoDB) {
  return db.platform ? [...db.users, db.platform.editor] : db.users;
}

export const DB_KEY = "cliva.demo.db";
export const SESSION_KEY = "cliva.demo.session";
const EMPTY_SESSION: SessionState = { userId: null, establishmentId: null, offline: false };

export const nowIso = () => {
  const d = new Date();
  return `${isoLocal(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

/** Nom d'opération du registre ↔ fonction de service (pour l'envoi à l'API). */
const OP_NAMES = new Map<unknown, string>(Object.entries(OPERATIONS).map(([name, def]) => [def.fn, name]));

interface DemoStore {
  db: DemoDB;
  session: SessionState;
  user: User | null;
  establishment: Establishment | null;
  today: string;
  /** true = mode connecté (API NestJS) ; false = démo localStorage. */
  apiMode: boolean;
  run: <I, T = undefined>(svc: Service<I, T>, input: I, opts?: { silent?: boolean }) => ServiceResult<T>;
  can: (m: ModuleId, a?: PermAction) => boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  setEstablishment: (id: string) => void;
  setOffline: (offline: boolean) => void;
  resetDemo: () => void;
  markNotificationsRead: () => void;
}

const DemoStoreContext = createContext<DemoStore | undefined>(undefined);

export const useDemo = () => {
  const c = useContext(DemoStoreContext);
  if (!c) throw new Error("useDemo must be used within DemoStoreProvider");
  return c;
};

function isValidDb(x: unknown): x is DemoDB {
  if (!x || typeof x !== "object") return false;
  const d = x as Partial<DemoDB>;
  return (d.schemaVersion === SCHEMA_VERSION || d.schemaVersion === 5 || d.schemaVersion === 6 || d.schemaVersion === 7 || d.schemaVersion === 8 || d.schemaVersion === 9 || d.schemaVersion === 10 || d.schemaVersion === 11 || d.schemaVersion === 12 || d.schemaVersion === 13 || d.schemaVersion === 14 || d.schemaVersion === 15 || d.schemaVersion === 16 || d.schemaVersion === 17 || d.schemaVersion === 18 || d.schemaVersion === 19 || d.schemaVersion === 20 || d.schemaVersion === 21 || d.schemaVersion === 22) && Array.isArray(d.clients) && Array.isArray(d.users) && Array.isArray(d.invoices) && !!d.settings && !!d.counters;
}

/** Met à niveau une base enregistrée par une version précédente sans perdre les données saisies. */
function upgrade(d: DemoDB): DemoDB {
  let x = d;
  if (x.schemaVersion === 5) x = migrateToV6(x, nowIso().slice(0, 10));
  if (x.schemaVersion === 6) x = migrateToV7(x, nowIso());
  if (x.schemaVersion === 7) x = migrateToV8(x);
  if (x.schemaVersion === 8) x = migrateToV9(x, nowIso().slice(0, 10));
  if (x.schemaVersion === 9) x = migrateToV10(x, nowIso().slice(0, 10));
  if (x.schemaVersion === 10) x = migrateToV11(x, isoLocal());
  if (x.schemaVersion === 11) x = migrateToV12(x, isoLocal());
  if (x.schemaVersion === 12) x = migrateToV13(x, isoLocal());
  if (x.schemaVersion === 13) x = migrateToV14(x, isoLocal());
  if (x.schemaVersion === 14) x = migrateToV15(x, isoLocal());
  if (x.schemaVersion === 15) x = migrateToV16(x, isoLocal());
  if (x.schemaVersion === 16) x = migrateToV17(x, isoLocal());
  if (x.schemaVersion === 17) x = migrateToV18(x, isoLocal());
  if (x.schemaVersion === 18) x = migrateToV19(x, isoLocal());
  if (x.schemaVersion === 19) x = migrateToV20(x, isoLocal());
  if (x.schemaVersion === 20) x = migrateToV21(x, isoLocal());
  if (x.schemaVersion === 21) x = migrateToV22(x);
  if (x.schemaVersion === 22) x = migrateToV23(x);
  return x;
}

function loadDb(): { db: DemoDB; restored: boolean } {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidDb(parsed)) return { db: upgrade(parsed), restored: false };
    }
    return { db: createSeed(new Date()), restored: !!raw };
  } catch {
    return { db: createSeed(new Date()), restored: true };
  }
}

function loadSession(): SessionState {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as SessionState | null;
    return s && typeof s === "object" ? { ...EMPTY_SESSION, ...s } : EMPTY_SESSION;
  } catch {
    return EMPTY_SESSION;
  }
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [db, setDb] = useState<DemoDB | null>(null);
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);
  const [mustChange, setMustChange] = useState(false);
  const dbRef = useRef<DemoDB | null>(null);
  const quotaWarnedRef = useRef(false);
  // Mode connecté : dernière version serveur connue + file d'envoi ordonnée.
  const serverVersionRef = useRef(0);
  const queueRef = useRef<PendingOp[]>([]);
  const sendingRef = useRef(false);
  const offlineToastRef = useRef(false);

  const persist = useCallback(
    (next: DemoDB) => {
      dbRef.current = next;
      setDb(next);
      if (apiMode) return; // mode connecté : l'état de référence vit sur le serveur
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(next));
        quotaWarnedRef.current = false;
      } catch {
        if (!quotaWarnedRef.current) {
          quotaWarnedRef.current = true;
          toast.show("error", "Stockage local saturé : les dernières modifications restent affichées mais ne seront pas conservées au rechargement. Supprimez des photos/pièces jointes volumineuses ou réinitialisez la démo (Administration → Démo).");
        }
      }
    },
    [toast],
  );

  const saveSession = useCallback((s: SessionState) => {
    setSession(s);
    if (apiMode) return; // mode connecté : la session réelle est le cookie httpOnly
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignoré : session non persistée */
    }
  }, []);

  /** Mode connecté : applique un état validé par le serveur. */
  const applyServerState = useCallback((data: DemoDB, version: number) => {
    serverVersionRef.current = version;
    const fresh = refreshDerived(data, nowIso().slice(0, 10));
    dbRef.current = fresh;
    setDb(fresh);
  }, []);

  /** Mode connecté : recharge l'état complet depuis le serveur. */
  const reloadState = useCallback(async () => {
    try {
      const st = await apiGetState();
      applyServerState(st.data, st.version);
    } catch {
      /* réessayé par l'interrogation périodique */
    }
  }, [applyServerState]);

  /** Mode connecté : envoie la file UNE opération à la fois, dans l'ordre. */
  const pumpQueue = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const op = queueRef.current[0];
        try {
          const res = await apiPostOp(op);
          queueRef.current.shift();
          offlineToastRef.current = false;
          if (res.ok) {
            // La version serveur a avancé : on recharge quand la file est vide
            // (sinon l'état local optimiste des opérations suivantes serait écrasé).
            if (res.version !== undefined && res.version !== serverVersionRef.current) {
              serverVersionRef.current = res.version;
              if (queueRef.current.length === 0) await reloadState();
            }
          } else {
            // Refus métier : l'état local optimiste est faux → on resynchronise.
            toast.show("error", res.error ?? "Opération refusée par le serveur.");
            await reloadState();
          }
        } catch (e) {
          if (e instanceof ApiNetworkError) {
            // Erreur réseau : on garde l'opération (même opKey) et on réessaie plus tard.
            if (!offlineToastRef.current) {
              offlineToastRef.current = true;
              toast.show("warning", "Envoi en attente : serveur injoignable, nouvelle tentative automatique.");
            }
            setTimeout(() => void pumpQueue(), 5000);
            return;
          }
          // Erreur HTTP (400/403…) : opération rejetée définitivement.
          queueRef.current.shift();
          toast.show("error", e instanceof Error ? e.message : "Opération rejetée par le serveur.");
          await reloadState();
        }
      }
    } finally {
      sendingRef.current = false;
    }
  }, [reloadState, toast]);

  /** Mode connecté : session issue du compte API + état serveur. */
  const bootstrapApi = useCallback(async () => {
    const ok = await apiRefresh();
    if (!ok) {
      // Pas de session : écran de connexion (placeholder local, jamais persisté).
      dbRef.current = createSeed(new Date());
      setDb(dbRef.current);
      setSession(EMPTY_SESSION);
      return;
    }
    try {
      const me = await apiMe();
      const st = await apiGetState();
      applyServerState(st.data, st.version);
      const u = st.data.users.find((x) => x.id === me.userId);
      setMustChange(me.mustChangePassword);
      setSession({ userId: me.userId, establishmentId: u?.establishmentId ?? null, offline: false });
    } catch {
      dbRef.current = createSeed(new Date());
      setDb(dbRef.current);
      setSession(EMPTY_SESSION);
      toast.show("error", "Impossible de charger les données depuis le serveur. Reconnectez-vous.");
    }
  }, [applyServerState, toast]);

  useEffect(() => {
    if (apiMode) {
      void bootstrapApi();
      return; // pas de localStorage ni d'écoute inter-onglets en mode connecté
    }
    const { db: loaded, restored } = loadDb();
    const fresh = refreshDerived(loaded, nowIso().slice(0, 10));
    persist(fresh);
    setSession(loadSession());
    if (restored) toast.show("warning", "Données locales absentes, obsolètes ou corrompues : le jeu de démonstration initial a été restauré.");
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY && e.newValue) {
        try {
          const parsed: unknown = JSON.parse(e.newValue);
          if (isValidDb(parsed)) {
            const up = upgrade(parsed);
            dbRef.current = up;
            setDb(up);
          }
        } catch {
          /* ignoré */
        }
      }
      if (e.key === SESSION_KEY) setSession(loadSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode connecté : toutes les 10 s et au retour sur l'onglet, comparer la
  // version serveur ; recharger l'état si elle a changé et que la file est vide.
  useEffect(() => {
    if (!apiMode || !session.userId) return;
    const check = async () => {
      if (queueRef.current.length > 0 || sendingRef.current) return;
      try {
        const { version } = await apiGetVersion();
        if (version !== serverVersionRef.current && queueRef.current.length === 0) {
          serverVersionRef.current = version;
          await reloadState();
        }
      } catch {
        /* serveur injoignable : on réessaiera au prochain tour */
      }
    };
    const interval = setInterval(() => void check(), 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.userId, reloadState]);

  const user = useMemo(() => (db && session.userId ? (accountsOf(db).find((u) => u.id === session.userId && u.active) ?? null) : null), [db, session.userId]);
  const establishment = useMemo(
    () => (db ? (db.establishments.find((e) => e.id === (session.establishmentId ?? user?.establishmentId)) ?? db.establishments[0]) : null),
    [db, session.establishmentId, user],
  );

  const run = useCallback(
    <I, T = undefined>(svc: Service<I, T>, input: I, opts?: { silent?: boolean }): ServiceResult<T> => {
      const current = dbRef.current;
      if (!current || !user || !establishment) {
        const r = { ok: false as const, error: "Session expirée : reconnectez-vous." };
        toast.show("error", r.error);
        return r;
      }
      const now = nowIso();
      // opKey : clé unique de l'opération (idempotence + ids déterministes, cf. executeService).
      const opKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const ctx: ActionCtx = { user, establishmentId: establishment.id, offline: session.offline, now, opKey };
      const r = executeService(svc, current, ctx, input);
      if (r.ok) {
        persist(refreshDerived(r.db, now.slice(0, 10)));
        if (!opts?.silent && r.message) toast.show("success", r.message);
        if (apiMode) {
          // Mode connecté : envoi de l'opération au serveur (file ordonnée).
          const name = OP_NAMES.get(svc);
          if (name) {
            queueRef.current.push({ opKey, name, input, clientNow: new Date().toISOString() });
            void pumpQueue();
          } else if (process.env.NODE_ENV === "development") {
            // Opération absente du registre : à ajouter dans src/lib/services/registry.ts.
            console.warn(`[Cliva API] Opération absente du registre OPERATIONS : elle ne sera PAS envoyée au serveur (modification locale seulement). Ajoutez-la dans src/lib/services/registry.ts.`, svc.name || svc);
          }
        }
      } else if (!opts?.silent) toast.show("error", r.error);
      return r;
    },
    [user, establishment, session.offline, persist, toast, pumpQueue],
  );

  const login = useCallback(
    (email: string, password: string): { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }> => {
      if (apiMode) {
        // Mode connecté : authentification réelle puis chargement de l'état serveur.
        return (async () => {
          const r = await apiLogin(email.trim(), password);
          if (!r.ok) return r;
          try {
            const me = await apiMe();
            const st = await apiGetState();
            applyServerState(st.data, st.version);
            const u = st.data.users.find((x) => x.id === me.userId);
            setMustChange(r.mustChangePassword);
            setSession({ userId: me.userId, establishmentId: u?.establishmentId ?? null, offline: false });
            return { ok: true };
          } catch {
            return { ok: false, error: "Connexion réussie mais chargement des données impossible. Réessayez." };
          }
        })();
      }
      const u = dbRef.current ? accountsOf(dbRef.current).find((x) => x.email.toLowerCase() === email.trim().toLowerCase()) : undefined;
      if (!u || u.demoPassword !== password) return { ok: false, error: "Identifiant ou mot de passe incorrect." };
      if (!u.active) return { ok: false, error: "Ce compte est désactivé." };
      saveSession({ userId: u.id, establishmentId: u.establishmentId, offline: false });
      return { ok: true };
    },
    [saveSession, applyServerState],
  );

  // Réglages du DG (droits, libellés) appliqués avant tout rendu.
  applyRoleSettings(db?.settings.permissions, db?.settings.roleLabels);
  applyLabelOverrides({ category: db?.settings.categoryLabels ?? {} });
  applyCategoryList(db?.settings.productCategories);
  const value = useMemo<DemoStore | null>(() => {
    if (!db) return null;
    return {
      db,
      session,
      user,
      establishment,
      today: nowIso().slice(0, 10),
      apiMode,
      run,
      can: (m, a = "read") => canRole(user?.roleId, m, a),
      login,
      logout: () => {
        if (apiMode) void apiLogout(); // révoque le cookie côté serveur
        clearAccessToken();
        saveSession(EMPTY_SESSION);
      },
      switchUser: (userId) => {
        if (apiMode) {
          toast.show("info", "Changement de profil indisponible en mode connecté : déconnectez-vous puis reconnectez-vous avec un autre compte.");
          return;
        }
        const u = accountsOf(db).find((x) => x.id === userId && x.active);
        if (u) {
          saveSession({ ...session, userId: u.id, establishmentId: u.establishmentId });
          toast.show("info", `Profil de démonstration actif : ${u.name}.`);
        }
      },
      setEstablishment: (id) => saveSession({ ...session, establishmentId: id }),
      setOffline: (offline) => {
        if (apiMode) {
          toast.show("info", "Simulation hors ligne indisponible en mode connecté.");
          return;
        }
        saveSession({ ...session, offline });
        toast.show(offline ? "warning" : "info", offline ? "Mode hors ligne — Simulation activé." : "Connexion simulée rétablie. Pensez à synchroniser les opérations en attente.");
      },
      resetDemo: () => {
        if (apiMode) {
          toast.show("info", "Réinitialisation indisponible en mode connecté : les données vivent sur le serveur.");
          return;
        }
        const fresh = refreshDerived(createSeed(new Date()), nowIso().slice(0, 10));
        persist(fresh);
        toast.show("success", "Environnement de démonstration réinitialisé : données initiales restaurées.");
      },
      markNotificationsRead: () => persist({ ...db, notifications: db.notifications.map((n) => (user && visibleTo(n, user) && !n.readBy?.includes(user.id) ? { ...n, readBy: [...(n.readBy ?? []), user.id] } : n)) }),
    };
  }, [db, session, user, establishment, run, login, saveSession, persist, toast]);

  if (!value) return <SplashScreen />;
  // Mode connecté : mot de passe initial à remplacer avant d'utiliser l'application.
  // L'écran est rendu DANS le Provider : il utilise ClivaLogo → useDemo().
  return (
    <DemoStoreContext.Provider value={value}>
      {apiMode && mustChange && user ? (
        <ChangePasswordScreen
          onDone={() => {
            // Recharge l'état serveur puis affiche l'application (sans reconnexion).
            void reloadState();
            setMustChange(false);
            toast.show("success", "Mot de passe enregistré.");
          }}
        />
      ) : (
        children
      )}
    </DemoStoreContext.Provider>
  );
}

export function SplashScreen({ label = "Chargement de l'environnement de démonstration…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900">
      <LogoMark className="size-14 animate-pulse" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
