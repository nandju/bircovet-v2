"use client";

/**
 * Magasin de données de DÉMONSTRATION (localStorage, versionné).
 * - aucune donnée réelle, aucun mot de passe réel ;
 * - accès à localStorage uniquement côté client (après montage) ;
 * - données absentes / corrompues / d'une ancienne version → jeu initial restauré.
 * Point d'intégration backend : remplacer `run` par des appels API.
 */
import { useToast } from "@/context/ToastContext";
import { LogoMark } from "@/icons";
import { isoLocal } from "@/lib/format";
import { can as canRole, type ModuleId, type PermAction } from "@/lib/permissions";
import { SCHEMA_VERSION, createSeed } from "@/lib/seed";
import { refreshDerived, type Service } from "@/lib/services/core";
import type { ActionCtx, DemoDB, Establishment, ServiceResult, SessionState, User } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export const DB_KEY = "bircovet.demo.db";
export const SESSION_KEY = "bircovet.demo.session";
const EMPTY_SESSION: SessionState = { userId: null, establishmentId: null, offline: false };

export const nowIso = () => {
  const d = new Date();
  return `${isoLocal(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

interface DemoStore {
  db: DemoDB;
  session: SessionState;
  user: User | null;
  establishment: Establishment | null;
  today: string;
  run: <I, T = undefined>(svc: Service<I, T>, input: I, opts?: { silent?: boolean }) => ServiceResult<T>;
  can: (m: ModuleId, a?: PermAction) => boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
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
  return d.schemaVersion === SCHEMA_VERSION && Array.isArray(d.clients) && Array.isArray(d.users) && Array.isArray(d.invoices) && !!d.settings && !!d.counters;
}

function loadDb(): { db: DemoDB; restored: boolean } {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidDb(parsed)) return { db: parsed, restored: false };
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
  const dbRef = useRef<DemoDB | null>(null);

  const persist = useCallback(
    (next: DemoDB) => {
      dbRef.current = next;
      setDb(next);
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(next));
      } catch {
        toast.show("error", "Impossible d'enregistrer localement (stockage du navigateur plein ou indisponible).");
      }
    },
    [toast],
  );

  const saveSession = useCallback((s: SessionState) => {
    setSession(s);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignoré : session non persistée */
    }
  }, []);

  useEffect(() => {
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
            dbRef.current = parsed;
            setDb(parsed);
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

  const user = useMemo(() => (db && session.userId ? (db.users.find((u) => u.id === session.userId && u.active) ?? null) : null), [db, session.userId]);
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
      const ctx: ActionCtx = { user, establishmentId: establishment.id, offline: session.offline, now };
      const r = svc(current, ctx, input);
      if (r.ok) {
        persist(refreshDerived(r.db, now.slice(0, 10)));
        if (!opts?.silent && r.message) toast.show("success", r.message);
      } else if (!opts?.silent) toast.show("error", r.error);
      return r;
    },
    [user, establishment, session.offline, persist, toast],
  );

  const login = useCallback(
    (email: string, password: string) => {
      const u = dbRef.current?.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!u || u.demoPassword !== password) return { ok: false, error: "Identifiant ou mot de passe incorrect." };
      if (!u.active) return { ok: false, error: "Ce compte est désactivé." };
      saveSession({ userId: u.id, establishmentId: u.establishmentId, offline: false });
      return { ok: true };
    },
    [saveSession],
  );

  const value = useMemo<DemoStore | null>(() => {
    if (!db) return null;
    return {
      db,
      session,
      user,
      establishment,
      today: nowIso().slice(0, 10),
      run,
      can: (m, a = "read") => canRole(user?.roleId, m, a),
      login,
      logout: () => saveSession(EMPTY_SESSION),
      switchUser: (userId) => {
        const u = db.users.find((x) => x.id === userId && x.active);
        if (u) {
          saveSession({ ...session, userId: u.id, establishmentId: u.establishmentId });
          toast.show("info", `Profil de démonstration actif : ${u.name}.`);
        }
      },
      setEstablishment: (id) => saveSession({ ...session, establishmentId: id }),
      setOffline: (offline) => {
        saveSession({ ...session, offline });
        toast.show(offline ? "warning" : "info", offline ? "Mode hors ligne — Simulation activé." : "Connexion simulée rétablie. Pensez à synchroniser les opérations en attente.");
      },
      resetDemo: () => {
        const fresh = refreshDerived(createSeed(new Date()), nowIso().slice(0, 10));
        persist(fresh);
        toast.show("success", "Environnement de démonstration réinitialisé : données initiales restaurées.");
      },
      markNotificationsRead: () => persist({ ...db, notifications: db.notifications.map((n) => ({ ...n, read: true })) }),
    };
  }, [db, session, user, establishment, run, login, saveSession, persist, toast]);

  if (!value) return <SplashScreen />;
  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function SplashScreen({ label = "Chargement de l'environnement de démonstration…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900">
      <LogoMark className="size-14 animate-pulse" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
