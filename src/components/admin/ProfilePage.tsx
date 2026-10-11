"use client";

import AvatarInitials from "@/components/common/AvatarInitials";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EntityHistory from "@/components/common/EntityHistory";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { establishmentName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { MODULE_LABELS, ROLE_LABELS, can, type ModuleId } from "@/lib/permissions";

export default function ProfilePage() {
  const { db, user, session } = useDemo();
  if (!user) return null;
  const modules = (Object.keys(MODULE_LABELS) as ModuleId[]).filter((m) => can(user.roleId, m, "read"));
  const myTasks = db.tasks.filter((t) => t.assigneeId === user.id && t.status !== "termine").slice(0, 6);
  const myActivity = db.audit.filter((a) => a.userId === user.id).slice(0, 15);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Mon profil" />
      <DemoNotice>Aucune gestion réelle de mot de passe dans cette démonstration — l&apos;authentification est simulée.</DemoNotice>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <ComponentCard className="lg:col-span-1" title="Identité">
          <div className="flex items-center gap-4">
            <AvatarInitials name={user.name} size="lg" />
            <div>
              <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{user.name}</p>
              <p className="text-sm text-gray-500">{user.title}</p>
            </div>
          </div>
          <InfoGrid
            items={[
              { label: "E-mail", value: user.email },
              { label: "Téléphone", value: user.phone },
              { label: "Rôle", value: ROLE_LABELS[user.roleId] },
              { label: "Établissement", value: establishmentName(db, user.establishmentId) },
              { label: "Compte créé", value: formatDate(user.createdAt) },
              { label: "Mode hors ligne", value: session.offline ? "Simulé actif" : "Non" },
              { label: "Statut", value: <StatusBadge kind="user" value={String(user.active)} /> },
            ]}
          />
        </ComponentCard>
        <ComponentCard title="Modules accessibles" className="lg:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {modules.map((m) => (
              <span key={m} className="rounded-full bg-brand-50 px-2.5 py-1 text-theme-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{MODULE_LABELS[m]}</span>
            ))}
          </div>
          {user.roleId === "confrere" && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Accès temporaire simulé à {user.sharedPatientIds?.length ?? 0} dossier(s) partagé(s).</p>
          )}
          <Link href="/administration/demo" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Changer de profil de démonstration</Link>
        </ComponentCard>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ComponentCard title={`Mes tâches en cours (${db.tasks.filter((t) => t.assigneeId === user.id && t.status !== "termine").length})`} actions={<Link href="/relation-client" className="text-sm font-medium text-brand-600">Tout voir</Link>}>
          {myTasks.length === 0 ? <p className="text-sm text-gray-500">Aucune tâche.</p> : (
            <ul className="space-y-2 text-sm">
              {myTasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-theme-xs text-gray-500">{formatDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </ComponentCard>
        <ComponentCard title="Mon activité récente (journal)">
          <EntityHistory items={myActivity.map((a) => ({ date: a.date, label: `${a.module} — ${a.action}`, detail: a.target }))} />
        </ComponentCard>
      </div>
    </div>
  );
}
