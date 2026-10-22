"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { applyBranding } from "@/lib/branding";
import { useEffect } from "react";

/** Applique la personnalisation visuelle (couleurs, police) de l'organisation courante. */
export default function BrandingApplier() {
  const { db } = useDemo();
  useEffect(() => {
    applyBranding(db.settings.branding);
  }, [db.settings.branding]);
  return null;
}
