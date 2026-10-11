"use client";

import { useDemo } from "@/context/DemoStoreContext";
import type { ModuleId, PermAction } from "@/lib/permissions";

/** Affiche le contenu seulement si le profil de démonstration dispose de la permission. */
export default function Can({ module, action = "read", children, fallback = null }: { module: ModuleId; action?: PermAction; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = useDemo();
  return <>{can(module, action) ? children : fallback}</>;
}
