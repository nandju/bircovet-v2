"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { RESPONSIBLE_VET_ROLES } from "@/lib/permissions";
import { useMemo } from "react";

/** Listes d'options partagées pour les sélecteurs de formulaires. */
export function useOptions() {
  const { db } = useDemo();
  return useMemo(
    () => ({
      clients: db.clients.filter((c) => c.status === "actif").map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
      patientsOf: (clientId?: string) =>
        db.patients.filter((p) => p.vitalStatus === "vivant" && !p.archived && (!clientId || p.ownerId === clientId)).map((p) => ({ value: p.id, label: `${p.name} — ${p.species} (${p.code})` })),
      vets: db.users.filter((u) => u.active && RESPONSIBLE_VET_ROLES.includes(u.roleId)).map((u) => ({ value: u.id, label: u.name })),
      users: db.users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name })),
      staff: db.users.filter((u) => u.active && ["dg", "vet", "assistant"].includes(u.roleId)).map((u) => ({ value: u.id, label: u.name })),
      products: db.products.filter((p) => p.status === "actif").map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
      accounts: db.accounts.map((a) => ({ value: a.id, label: a.name })),
      suppliers: db.suppliers.filter((s) => s.status === "actif").map((s) => ({ value: s.id, label: s.name })),
      establishments: db.establishments.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name })),
      farms: db.farms.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
    }),
    [db],
  );
}
