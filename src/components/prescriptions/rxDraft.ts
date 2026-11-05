"use client";

import type { OrderLineInput } from "@/lib/services/prescriptionsService";
import { useState } from "react";

/** Ordonnance en cours de préparation dans le calculateur (plusieurs calculs avant de l'enregistrer). */
export type DraftLine = OrderLineInput & { label: string };
const KEY = "cliva.rx.draft";

function read(): DraftLine[] {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DraftLine[]) : [];
  } catch {
    return [];
  }
}

export function useRxDraft(): [DraftLine[], (lines: DraftLine[]) => void] {
  const [lines, setLines] = useState<DraftLine[]>(read);
  const save = (next: DraftLine[]) => {
    setLines(next);
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible : la liste reste en mémoire */
    }
  };
  return [lines, save];
}
