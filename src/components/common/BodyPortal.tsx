"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Rend son contenu à la racine de la page (ex. une fenêtre ouverte depuis l'en-tête, qui sinon y resterait enfermée). */
export default function BodyPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- le portail n'existe qu'après le montage
    setReady(true);
  }, []);
  return ready ? createPortal(children, document.body) : null;
}
