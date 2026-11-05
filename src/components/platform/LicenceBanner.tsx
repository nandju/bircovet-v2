"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { formatDate } from "@/lib/format";
import { maintenanceState, selfClinic } from "@/lib/platform";

/** Rappel discret au DG de la clinique quand la maintenance arrive à échéance (aucun blocage). */
export default function LicenceBanner() {
  const { db, today } = useDemo();
  const me = selfClinic(db);
  if (!me || !db.platform) return null;
  const { state, days } = maintenanceState(me, today, db.platform.offer.graceDays);
  if (state === "a_jour" || state === "sans" || days === null) return null;
  const late = days < 0;
  return (
    <div role="status" className={`fixed inset-x-3 bottom-3 z-9 mx-auto max-w-xl rounded-2xl border px-4 py-3 text-theme-sm shadow-theme-lg sm:start-auto sm:end-24 ${late ? "border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-950 dark:text-error-300" : "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/30 dark:bg-warning-950 dark:text-warning-300"}`}>
      <strong>{late ? "Maintenance Cliva échue" : "Maintenance Cliva à renouveler"}</strong> — {late ? `depuis le ${formatDate(me.paidUntil)}` : `jusqu'au ${formatDate(me.paidUntil)} (${days} j)`}. Votre licence et vos données restent les vôtres ; la maintenance couvre les mises à jour et l&apos;assistance.
    </div>
  );
}
