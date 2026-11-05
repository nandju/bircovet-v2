"use client";

import { pushSupported, systemNotify } from "@/components/common/AlertCenter";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useNow } from "@/hooks/useNow";
import { ALERT_DEFS, evaluateAlerts, rulesOf } from "@/lib/alerts";
import { runAlertScan, saveAlertRules, sendTestNotification } from "@/lib/services/alertsService";
import type { AlertRule, RoleId } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const ROLES: { id: RoleId; label: string }[] = [
  { id: "dg", label: "DG" },
  { id: "vet", label: "Vétérinaires" },
  { id: "assistant", label: "Assistants" },
  { id: "accueil", label: "Accueil" },
  { id: "comptable", label: "Comptable" },
];

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200", on ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700", disabled && "opacity-50")}>
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-theme-xs transition-[inset-inline-start] duration-200", on ? "start-4.5" : "start-0.5")} />
    </button>
  );
}

export default function AlertsSettingsPage() {
  const { db, run, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const now = useNow();
  const [rules, setRules] = useState<AlertRule[]>(() => rulesOf(db));
  const [perm, setPerm] = useState<string>("indisponible");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'état du navigateur après montage
    setPerm(pushSupported() ? Notification.permission : "indisponible");
  }, []);
  const set = (key: string, patch: Partial<AlertRule>) => setRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pending = evaluateAlerts({ ...db, settings: { ...db.settings, alertRules: rules } }, now);
  const countFor = (k: string) => pending.filter((p) => p.notif.rule === k).length;
  const groups = [...new Set(ALERT_DEFS.map((d) => d.group))];
  const ask = async () => {
    if (!pushSupported()) return;
    try {
      setPerm(await Notification.requestPermission());
    } catch {
      setPerm("denied");
    }
  };
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Alertes et notifications"
        subtitle="Choisissez ce qui déclenche une alerte, qui la reçoit, à partir de quel seuil, et si elle part en push"
        trail={[{ label: "Administration", href: "/administration/parametres" }]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => run(runAlertScan, {})}>Vérifier maintenant</Button>
            {isDG && <Button size="sm" onClick={() => run(saveAlertRules, rules)}>Enregistrer</Button>}
          </>
        }
      />
      <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Notifications push sur cet appareil</h3>
            <p className="text-theme-xs text-gray-500">
              État : <strong>{perm === "granted" ? "autorisées" : perm === "denied" ? "bloquées par le navigateur" : perm === "default" ? "pas encore autorisées" : "non prises en charge ici"}</strong>. Chaque membre de l&apos;équipe active le push sur son téléphone ou son ordinateur. Elles s&apos;affichent tant que Cliva est ouvert ; l&apos;envoi application fermée nécessitera le serveur (phase backend).
            </p>
          </div>
          {perm !== "granted" && <Button size="sm" variant="soft" onClick={ask} disabled={perm === "indisponible"}>Autoriser le push</Button>}
          <Button size="sm" variant="outline" onClick={() => { run(sendTestNotification, {}); systemNotify("Cliva", "Test de notification push."); }}>Tester</Button>
        </div>
      </section>
      {!isDG && <p className="text-sm text-gray-500">Consultation seule : seul le DG modifie les règles.</p>}
      {groups.map((g) => (
        <section key={g} className="cliva-rise overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">{g}</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {ALERT_DEFS.filter((d) => d.group === g).map((d) => {
              const r = rules.find((x) => x.key === d.key)!;
              return (
                <li key={d.key} className={cn("grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[1fr_auto]", !r.enabled && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <Switch on={r.enabled} onChange={(v) => set(d.key, { enabled: v })} label={`Activer : ${d.label}`} disabled={!isDG} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{d.label} {countFor(d.key) > 0 && <span className="ms-1 rounded-full bg-warning-50 px-1.5 py-0.5 text-[11px] text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">{countFor(d.key)} en cours</span>}</p>
                      <p className="text-theme-xs text-gray-500">{d.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ps-12 lg:ps-0">
                    {d.unit && (
                      <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
                        Seuil
                        <input type="number" min={0} max={d.unit.includes("FCFA") ? 100000000 : 365} step={d.unit.includes("FCFA") ? 1000 : 1} value={r.threshold} disabled={!isDG} onChange={(e) => set(d.key, { threshold: Number(e.target.value) })} className={cn("h-8 rounded-lg border", d.unit.includes("FCFA") ? "w-24" : "w-16", " border-gray-300 bg-transparent px-2 text-sm tabular-nums dark:border-gray-700 dark:text-white/90")} />
                        {d.unit}
                      </label>
                    )}
                    <div className="flex flex-wrap gap-1" aria-label="Destinataires">
                      {ROLES.map((ro) => (
                        <button key={ro.id} type="button" disabled={!isDG} aria-pressed={r.roles.includes(ro.id)} onClick={() => set(d.key, { roles: r.roles.includes(ro.id) ? r.roles.filter((x) => x !== ro.id) : [...r.roles, ro.id] })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", r.roles.includes(ro.id) ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400")}>
                          {ro.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400"><Switch on={r.owner} onChange={(v) => set(d.key, { owner: v })} label="Personne concernée" disabled={!isDG} />Personne concernée</label>
                    <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400"><Switch on={r.push} onChange={(v) => set(d.key, { push: v })} label="Push" disabled={!isDG} />Push</label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
