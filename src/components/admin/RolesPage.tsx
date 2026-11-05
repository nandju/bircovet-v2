"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { ACTION_LABELS, ACTION_LETTER, defaultLetters, letters, MODULE_LABELS, ROLE_LABELS, roleDescription, roleLabel, type ModuleId, type PermAction } from "@/lib/permissions";
import { resetRolePermissions, setRoleLabel, setRolePermission, setUserRole } from "@/lib/services/adminService";
import type { RoleId } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const ACTIONS = Object.keys(ACTION_LABELS) as PermAction[];
const MODULES = (Object.keys(MODULE_LABELS) as ModuleId[]).filter((m) => m !== "plateforme");
const ROLES = (Object.keys(ROLE_LABELS) as RoleId[]).filter((r) => r !== "editeur");
const ORDER = "rcuvea";

/** Le DG règle les droits de chaque rôle (clic sur une case), renomme les rôles et y affecte les membres. */
export default function RolesPage() {
  const { db, run, user } = useDemo();
  const isDG = user?.roleId === "dg";
  const [role, setRole] = useState<RoleId>("vet");
  const [lab, setLab] = useState({ label: "", description: "" });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- formulaire du rôle sélectionné
    setLab({ label: roleLabel(role), description: roleDescription(role) });
  }, [role, db.settings.roleLabels]);
  const toggle = (m: ModuleId, a: PermAction) => {
    const cur = letters(role, m);
    const l = ACTION_LETTER[a];
    let next = cur.includes(l) ? cur.replace(l, "") : cur + l;
    if (a === "read" && cur.includes("r")) next = ""; // retirer la lecture retire tout
    next = ORDER.split("").filter((c) => next.includes(c)).join("");
    run(setRolePermission, { role, module: m, letters: next }, { silent: true });
  };
  const changed = MODULES.filter((m) => letters(role, m) !== defaultLetters(role, m)).length;
  const members = db.users.filter((u) => u.active && u.roleId === role);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Rôles et autorisations" subtitle={isDG ? "Cliquez sur une case pour accorder ou retirer un droit" : "Consultation des droits par rôle"} trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} />
      <DemoNotice tone="warning">Droits appliqués dans l&apos;application (menus, boutons, pages). En production, ils seront aussi contrôlés par le serveur.</DemoNotice>
      <Tabs tabs={ROLES.map((r) => ({ key: r, label: roleLabel(r), count: db.users.filter((u) => u.roleId === r && u.active).length }))} active={role} onChange={(k) => setRole(k as RoleId)} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
        <ComponentCard
          title={`Droits — ${roleLabel(role)}`}
          desc={changed ? `${changed} module(s) modifié(s) par rapport aux droits par défaut (surlignés).` : "Droits par défaut."}
          actions={isDG && changed > 0 && <Button size="sm" variant="outline" onClick={() => run(resetRolePermissions, { role })}>Rétablir les droits par défaut</Button>}
        >
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">
                  <th className="py-2 pe-3 text-start">Module</th>
                  {ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center">{ACTION_LABELS[a]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {MODULES.map((m) => {
                  const mod = letters(role, m) !== defaultLetters(role, m);
                  const locked = role === "dg" && m === "admin";
                  return (
                    <tr key={m} className={mod ? "bg-warning-25 dark:bg-warning-500/5" : ""}>
                      <td className="py-1.5 pe-3 text-gray-800 dark:text-white/90">{MODULE_LABELS[m]}</td>
                      {ACTIONS.map((a) => {
                        const on = letters(role, m).includes(ACTION_LETTER[a]);
                        return (
                          <td key={a} className="px-1 py-1 text-center">
                            <button
                              type="button"
                              disabled={!isDG || locked}
                              onClick={() => toggle(m, a)}
                              aria-pressed={on}
                              aria-label={`${ACTION_LABELS[a]} — ${MODULE_LABELS[m]}`}
                              className={cn("cliva-press mx-auto flex size-7 items-center justify-center rounded-full text-theme-xs font-semibold transition", on ? "bg-linear-to-br from-brand-500 to-brand-600 text-white shadow-theme-xs" : "border border-gray-200 text-gray-300 hover:border-brand-300 dark:border-gray-700 dark:text-gray-600", (!isDG || locked) && "cursor-not-allowed opacity-70")}
                            >
                              {on ? "✓" : "–"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-theme-xs text-gray-500">Retirer la lecture retire tous les droits du module ; accorder une action donne aussi la lecture.</p>
        </ComponentCard>
        <div className="space-y-4">
          <ComponentCard title="Nom et mission du rôle">
            <TextField label="Nom affiché" value={lab.label} onChange={(x) => setLab({ ...lab, label: x })} disabled={!isDG} />
            <TextField label="Description" value={lab.description} onChange={(x) => setLab({ ...lab, description: x })} disabled={!isDG} />
            {isDG && <Button size="sm" onClick={() => run(setRoleLabel, { role, ...lab })}>Enregistrer</Button>}
          </ComponentCard>
          <ComponentCard title={`Membres (${members.length})`}>
            <ul className="space-y-2">
              {db.users.filter((u) => u.active).map((u) => (
                <li key={u.id} className={cn("flex items-center justify-between gap-2 rounded-xl px-2 py-1.5", u.roleId === role ? "bg-brand-25 dark:bg-brand-500/10" : "")}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-800 dark:text-white/90">{u.name}</span>
                    <span className="block truncate text-[11px] text-gray-500">{roleLabel(u.roleId)}</span>
                  </span>
                  {isDG && (
                    <select aria-label={`Rôle de ${u.name}`} value={u.roleId} onChange={(e) => run(setUserRole, { userId: u.id, roleId: e.target.value as RoleId })} className="h-8 rounded-full border border-gray-200 bg-white px-2 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}
