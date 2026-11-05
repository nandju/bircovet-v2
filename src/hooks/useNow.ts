"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { isoLocal } from "@/lib/format";
import { useEffect, useState } from "react";

/** Date-heure locale « AAAA-MM-JJTHH:MM », rafraîchie chaque minute et calée sur la date de démonstration. */
export function useNow() {
  const { today } = useDemo();
  const [now, setNow] = useState(() => isoLocal());
  useEffect(() => {
    const t = setInterval(() => setNow(isoLocal()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now.slice(0, 10) === today ? now : `${today}T12:00`;
}
