"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { invoiceBalance, isActiveInvoice } from "@/lib/calc";
import { addDays } from "@/lib/format";
import { signedRevenue, stockAlerts } from "@/lib/services/reportsService";
import { useMemo } from "react";

const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

/** KPI calculés à partir des données locales (se mettent à jour après chaque opération). */
export function useDashboardData(est?: string) {
  const { db, today } = useDemo();
  return useMemo(() => {
    // Fenêtres glissantes de 30 jours : évite un tableau de bord vide (0 F CFA, -100 %) en début de mois.
    const cur = { from: addDays(today, -29), to: today };
    const prev = { from: addDays(today, -59), to: addDays(today, -30) };
    type Win = typeof cur;
    const inWin = (date: string, w: Win) => {
      const d = date.slice(0, 10);
      return d >= w.from && d <= w.to;
    };
    const inEst = (e?: string) => !est || e === est;
    const accEst = (accountId: string) => db.accounts.find((a) => a.id === accountId)?.establishmentId;

    const revenue = (w: Win) => db.invoices.filter((i) => inWin(i.date, w) && inEst(i.establishmentId)).reduce((s, i) => s + signedRevenue(i), 0);
    const collected = (w: Win) => db.payments.filter((p) => inWin(p.date, w) && inEst(accEst(p.accountId))).reduce((s, p) => s + p.amount, 0);
    const consults = (w: Win) => db.consultations.filter((c) => inWin(c.date, w) && inEst(c.establishmentId)).length;
    const unpaid = db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && inEst(i.establishmentId) && invoiceBalance(db, i) > 0);
    const alerts = stockAlerts(db, today, est);
    const todayAppts = db.appointments.filter((a) => a.start.startsWith(today) && inEst(a.establishmentId) && a.status !== "annule" && a.status !== "demande");
    const newClients30 = db.clients.filter((c) => c.createdAt >= addDays(today, -30)).length;

    return {
      clients: db.clients.filter((c) => c.status === "actif").length,
      newClients30,
      patients: db.patients.filter((p) => p.vitalStatus === "vivant" && !p.archived).length,
      todayAppointments: todayAppts.length,
      waiting: todayAppts.filter((a) => a.queueStatus === "arrive" || a.queueStatus === "regle").length,
      inConsultation: db.consultations.filter((c) => c.status !== "valide" && inEst(c.establishmentId)).length + todayAppts.filter((a) => a.queueStatus === "en_consultation" && !a.consultationId).length,
      hospitalized: db.hospitalizations.filter((h) => h.status === "en_cours" && inEst(h.establishmentId)).length,
      revenue: revenue(cur),
      revenueDelta: pct(revenue(cur), revenue(prev)),
      collected: collected(cur),
      collectedDelta: pct(collected(cur), collected(prev)),
      consultations30: consults(cur),
      consultationsDelta: pct(consults(cur), consults(prev)),
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((s, i) => s + invoiceBalance(db, i), 0),
      lowStock: alerts.low.length,
      expiring: alerts.expiring.length,
      overdueTasks: db.tasks.filter((t) => t.status !== "termine" && t.dueDate < today).length,
      missionsPlanned: db.missions.filter((m) => (m.status === "planifiee" || m.status === "en_cours") && inEst(m.establishmentId)).length,
      alerts,
      unpaid,
      todayAppts,
    };
  }, [db, today, est]);
}
