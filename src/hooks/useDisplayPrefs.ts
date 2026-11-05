"use client";

import { useCallback, useEffect, useState } from "react";

export type TextSize = "normal" | "grand" | "tres-grand";
export interface DisplayPrefs {
  size: TextSize;
  calm: boolean;
  /** Menu réduit aux tâches essentielles. */
  simple: boolean;
}

const KEY = "cliva.display";
const EVT = "cliva-display";
export const DEFAULT_DISPLAY: DisplayPrefs = { size: "normal", calm: false, simple: false };

function read(): DisplayPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { size: ["normal", "grand", "tres-grand"].includes(v.size) ? v.size : "normal", calm: !!v.calm, simple: !!v.simple };
  } catch {
    return DEFAULT_DISPLAY;
  }
}

/** Préférences d'affichage propres à l'appareil, partagées entre composants. */
export function useDisplayPrefs(): [DisplayPrefs, (p: DisplayPrefs) => void] {
  const [pref, setPref] = useState<DisplayPrefs>(DEFAULT_DISPLAY);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture des préférences enregistrées sur l'appareil
    setPref(read());
    const on = () => setPref(read());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const save = useCallback((p: DisplayPrefs) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* stockage indisponible : réglage gardé pour la session */
    }
    setPref(p);
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [pref, save];
}

/** Entrées du menu simplifié (les autres restent accessibles par la recherche et « Que voulez-vous faire ? »). */
export const SIMPLE_MENU = new Set([
  "overview", "approvals", "help",
  "agenda", "agendaCalendar", "agendaQueue", "agendaRequests",
  "clients", "clientsList", "clientsNew",
  "patients", "consultations", "consultationsList", "consultationsNew", "consultationsHome", "hospitalization",
  "farms", "careFollowUp", "prophylaxis", "teamTasks",
  "stock", "stockSale", "stockOverview", "stockCalculator", "stockDrugIndex", "stockAlerts",
  "finance", "payments", "expenses", "projects", "financeRevenue", "cashBoxes",
  "reports", "reportsRevenue", "reportsMargins",
]);
