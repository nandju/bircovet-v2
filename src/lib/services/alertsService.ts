import { ALERT_DEFS, evaluateAlerts } from "../alerts";
import { addDays } from "../format";
import type { AlertRule } from "../types";
import { fail, notify, produce, type Service } from "./core";

/** Envoie les alertes du jour qui n'ont pas encore été envoyées. */
export const runAlertScan: Service<Record<string, never>, number> = (db, ctx) =>
  produce(db, (d) => {
    const log = { ...(d.alertLog ?? {}) };
    const today = ctx.now.slice(0, 10);
    let sent = 0;
    for (const a of evaluateAlerts(d, ctx.now)) {
      if (log[a.dedupe]) continue;
      notify(d, ctx, a.notif);
      log[a.dedupe] = today;
      sent++;
    }
    // Purge du journal au-delà de 14 jours.
    const limit = addDays(today, -14);
    for (const k of Object.keys(log)) if (log[k] < limit) delete log[k];
    d.alertLog = log;
    return { message: sent ? `${sent} alerte(s) envoyée(s).` : "Aucune nouvelle alerte.", data: sent };
  });

export const saveAlertRules: Service<AlertRule[]> = (db, ctx, rules) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG paramètre les alertes.");
    for (const r of rules) {
      const def = ALERT_DEFS.find((x) => x.key === r.key);
      if (!def) fail("Règle inconnue.");
      const max = def.unit?.includes("FCFA") ? 100_000_000 : 365;
      if (!(r.threshold >= 0 && r.threshold <= max)) fail(`Seuil entre 0 et ${max.toLocaleString("fr-FR")} pour « ${def.label} ».`);
    }
    d.settings.alertRules = rules;
    // Les alertes du jour seront réévaluées avec les nouveaux réglages.
    d.alertLog = {};
    return { message: "Réglages des alertes enregistrés." };
  });

export const sendTestNotification: Service<Record<string, never>> = (db, ctx) =>
  produce(db, (d) => {
    notify(d, ctx, { title: "Notification de test", body: "Si vous voyez ce message en dehors de l'onglet, le push fonctionne sur cet appareil.", level: "info", push: true, toUserIds: [ctx.user.id], link: "/administration/alertes" });
    return { message: "Notification de test envoyée." };
  });
