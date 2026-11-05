"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { useToast } from "@/context/ToastContext";
import { isRead, visibleTo } from "@/lib/notifications";
import { runAlertScan } from "@/lib/services/alertsService";
import { useEffect, useRef } from "react";

const SCAN_MS = 5 * 60_000;
const SHOWN_KEY = "cliva.push.shown";

function loadShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveShown(s: Set<string>) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-300)));
  } catch {
    /* stockage indisponible */
  }
}

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Affiche une notification système si le navigateur l'autorise (sinon rien). */
export function systemNotify(title: string, body: string, tag?: string) {
  try {
    if (pushSupported() && Notification.permission === "granted") {
      new Notification(title, { body, tag, icon: "/favicon.ico" });
      return true;
    }
  } catch {
    /* navigateur sans prise en charge */
  }
  return false;
}

/**
 * Moteur d'alertes côté navigateur : vérifie les règles à l'ouverture puis toutes les 5 minutes,
 * et pousse les nouvelles notifications marquées « push » (notification système + bandeau).
 */
export default function AlertCenter() {
  const { db, run, user } = useDemo();
  const toast = useToast();
  const runRef = useRef(run);
  const ready = useRef(false);
  const mountedAt = useRef(0);
  const summary = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef(0);
  useEffect(() => () => clearTimeout(summary.current), []);
  useEffect(() => {
    pendingRef.current = user ? db.notifications.filter((n) => n.push && visibleTo(n, user) && !isRead(n, user.id)).length : 0;
  }, [db.notifications, user]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (!user) return;
    const scan = () => runRef.current(runAlertScan, {}, { silent: true });
    const first = setTimeout(scan, 1500);
    const t = setInterval(scan, SCAN_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const shown = loadShown();
    const fresh = db.notifications.filter((n) => n.push && visibleTo(n, user) && !isRead(n, user.id) && !shown.has(n.id));
    const opening = !ready.current || Date.now() - mountedAt.current < 15_000;
    if (opening) {
      // À l'ouverture : pas de rafale, un seul résumé après la vérification initiale.
      if (!ready.current) {
        mountedAt.current = Date.now();
        summary.current = setTimeout(() => {
          const n = pendingRef.current;
          if (n) toast.show("info", `${n} alerte(s) non lue(s) — voir la cloche.`);
        }, 3000);
      }
      ready.current = true;
      fresh.forEach((n) => shown.add(n.id));
      saveShown(shown);
      return;
    }
    if (!fresh.length) return;
    const top = fresh.slice(0, 3);
    for (const n of top) {
      const sys = systemNotify(n.title, n.body, n.id);
      if (!sys || document.visibilityState === "visible") toast.show(n.level === "critique" || n.level === "alerte" ? "warning" : "info", `${n.title} — ${n.body}`);
    }
    if (fresh.length > 3) toast.show("info", `+ ${fresh.length - 3} autre(s) alerte(s).`);
    fresh.forEach((n) => shown.add(n.id));
    saveShown(shown);
  }, [db.notifications, user, toast]);

  return null;
}
