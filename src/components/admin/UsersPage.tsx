"use client";

import AppModal from "@/components/common/AppModal";
import AvatarInitials from "@/components/common/AvatarInitials";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import EntityHistory from "@/components/common/EntityHistory";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon } from "@/icons";
import { establishmentName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { createUser, setUserActive, updateUser, type UserInput } from "@/lib/services/adminService";
import type { RoleId, User } from "@/lib/types";
import { useEffect, useState } from "react";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as RoleId[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export default function UsersPage() {
  const { db, run, user: me } = useDemo();
  const opts = useOptions();
  const modal = useModal();
  const [editing, setEditing] = useState<User | undefined>();
  const [toggle, setToggle] = useState<User | null>(null);
  const [historyOf, setHistoryOf] = useState<User | null>(null);
  const [v, setV] = useState<UserInput>({ name: "", email: "", roleId: "assistant", establishmentId: "", title: "", phone: "" });
  useEffect(() => {
    if (modal.isOpen) setV(editing ? { name: editing.name, email: editing.email, roleId: editing.roleId, establishmentId: editing.establishmentId, title: editing.title, phone: editing.phone } : { name: "", email: "", roleId: "assistant", establishmentId: db.establishments[0]?.id ?? "", title: "", phone: "" });
  }, [modal.isOpen, editing, db.establishments]);

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Utilisateurs" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => { setEditing(undefined); modal.openModal(); }}>Nouvel utilisateur</Button>} />
      <DemoNotice>Comptes fictifs de démonstration. La désactivation n&apos;efface jamais l&apos;historique d&apos;un utilisateur. Aucune gestion réelle des mots de passe n&apos;est effectuée.</DemoNotice>
      <Panel>
        <DataTable
          rows={db.users}
          rowKey={(u) => u.id}
          columns={[
            { key: "n", header: "Utilisateur", primary: true, sortValue: (u) => u.name, render: (u) => <span className="flex items-center gap-3"><AvatarInitials name={u.name} size="sm" /><span className="flex flex-col"><span className="font-medium">{u.name}</span><span className="text-theme-xs text-gray-500">{u.email}</span></span></span> },
            { key: "r", header: "Rôle", sortValue: (u) => u.roleId, render: (u) => ROLE_LABELS[u.roleId] },
            { key: "t", header: "Fonction", hideOnMobile: true, render: (u) => u.title },
            { key: "e", header: "Établissement", render: (u) => establishmentName(db, u.establishmentId).replace("Cliva ", "") },
            { key: "c", header: "Créé le", hideOnMobile: true, render: (u) => formatDate(u.createdAt) },
            { key: "s", header: "Statut", render: (u) => <StatusBadge kind="user" value={String(u.active)} /> },
            {
              key: "x",
              header: "Actions",
              render: (u) => (
                <span className="flex flex-wrap gap-1">
                  <Button size="xs" variant="ghost" onClick={() => { setEditing(u); modal.openModal(); }}>Modifier</Button>
                  <Button size="xs" variant="ghost" onClick={() => setHistoryOf(u)}>Activité</Button>
                  {u.id !== me?.id && <Button size="xs" variant={u.active ? "ghost" : "soft"} className={u.active ? "text-error-600" : ""} onClick={() => setToggle(u)}>{u.active ? "Désactiver" : "Réactiver"}</Button>}
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <AppModal
        isOpen={modal.isOpen}
        onClose={modal.closeModal}
        title={editing ? `Modifier — ${editing.name}` : "Nouvel utilisateur"}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={modal.closeModal}>Annuler</Button>
            <Button size="sm" onClick={() => (editing ? run(updateUser, { id: editing.id, patch: v }) : run(createUser, v)).ok && modal.closeModal()} disabled={!v.name.trim() || !v.email.trim()}>Enregistrer</Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Nom" required value={v.name} onChange={(name) => setV({ ...v, name })} />
          <TextField label="E-mail (identifiant)" required value={v.email} onChange={(email) => setV({ ...v, email })} />
          <SelectField label="Rôle" value={v.roleId} onChange={(x) => setV({ ...v, roleId: x as RoleId })} options={ROLE_OPTIONS} />
          <SelectField label="Établissement" value={v.establishmentId} onChange={(establishmentId) => setV({ ...v, establishmentId })} options={opts.establishments} />
          <TextField label="Fonction" value={v.title} onChange={(title) => setV({ ...v, title })} />
          <TextField label="Téléphone" value={v.phone} onChange={(phone) => setV({ ...v, phone })} />
        </FormGrid>
      </AppModal>
      <ConfirmDialog isOpen={!!toggle} onClose={() => setToggle(null)} title={toggle?.active ? "Désactiver l'utilisateur" : "Réactiver l'utilisateur"} tone={toggle?.active ? "danger" : "primary"} message={toggle?.active ? "L'utilisateur ne pourra plus se connecter ; son historique (actes, validations, journal) est conservé." : "L'utilisateur pourra de nouveau se connecter."} reasonLabel="Motif" onConfirm={(reason) => (toggle ? run(setUserActive, { id: toggle.id, active: !toggle.active, reason }).ok : false)} />
      <AppModal isOpen={!!historyOf} onClose={() => setHistoryOf(null)} title={`Historique d'activité — ${historyOf?.name ?? ""}`} size="lg">
        {historyOf && <EntityHistory items={db.audit.filter((a) => a.userId === historyOf.id).map((a) => ({ date: a.date, label: `${a.module} — ${a.action}`, detail: a.target, userId: a.userId }))} auditTargets={[historyOf.name]} />}
      </AppModal>
    </div>
  );
}
