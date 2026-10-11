"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { CheckLineIcon } from "@/icons";
import { ACTION_LABELS, MODULE_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, can, type ModuleId, type PermAction } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const ACTIONS = Object.keys(ACTION_LABELS) as PermAction[];
const MODULES = Object.keys(MODULE_LABELS) as ModuleId[];
const ROLES = Object.keys(ROLE_LABELS) as RoleId[];

export default function RolesPage() {
  const { db } = useDemo();
  const [role, setRole] = useState<RoleId>("vet");
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Rôles et permissions" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} />
      <DemoNotice tone="warning">Matrice de permissions SIMULÉE côté navigateur. Elle pilote l&apos;affichage des menus et des actions de la démonstration mais ne constitue pas une protection des données : les autorisations réelles seront appliquées par le serveur.</DemoNotice>
      <Tabs tabs={ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r], count: db.users.filter((u) => u.roleId === r && u.active).length }))} active={role} onChange={(k) => setRole(k as RoleId)} />
      <ComponentCard title={ROLE_LABELS[role]} desc={ROLE_DESCRIPTIONS[role]}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">
                <th className="py-2 pe-3 text-start">Module</th>
                {ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center">{ACTION_LABELS[a]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="py-2 pe-3 text-gray-800 dark:text-white/90">{MODULE_LABELS[m]}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      {can(role, m, a) ? <CheckLineIcon className="mx-auto size-4 text-brand-500" aria-label="Autorisé" /> : <span className="text-gray-300 dark:text-gray-700" aria-label="Non autorisé">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ComponentCard>
      <ComponentCard title="Vue d'ensemble : lecture par rôle">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full text-theme-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="py-2 pe-3 text-start">Module</th>
                {ROLES.map((r) => <th key={r} className="px-2 py-2 text-center">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="py-1.5 pe-3">{MODULE_LABELS[m]}</td>
                  {ROLES.map((r) => {
                    const letters = ACTIONS.filter((a) => can(r, m, a)).map((a) => ACTION_LABELS[a][0]).join("");
                    return <td key={r} className={cn("px-2 py-1.5 text-center font-mono", letters ? "text-brand-700 dark:text-brand-300" : "text-gray-300 dark:text-gray-700")}>{letters || "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-theme-xs text-gray-500">L = lecture, C = création, M = modification, V = validation, E = export, A = administration.</p>
      </ComponentCard>
    </div>
  );
}
