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
import { useToast } from "@/context/ToastContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon } from "@/icons";
import { apiCreateAccount, apiResetPassword } from "@/lib/api";
import { establishmentName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { createUser, setUserActive, updateUser, type UserInput } from "@/lib/services/adminService";
import type { RoleId, User } from "@/lib/types";
import { useEffect, useState } from "react";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as RoleId[]).filter((r) => r !== "editeur").map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export default function UsersPage() {
  const { db, run, user: me, apiMode, refresh } = useDemo();
  const toast = useToast();
  const opts = useOptions();
  const modal = useModal();
  const [editing, setEditing] = useState<User | undefined>();
  const [toggle, setToggle] = useState<User | null>(null);
  const [historyOf, setHistoryOf] = useState<User | null>(null);
  const [v, setV] = useState<UserInput>({ name: "", email: "", roleId: "assistant", establishmentId: "", title: "", phone: "" });
  // Mode connecté : la création passe par POST /api/accounts (utilisateur + accès en une transaction).
  const [tempPwd, setTempPwd] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    if (modal.isOpen) {
      setV(editing ? { name: editing.name, email: editing.email, roleId: editing.roleId, establishmentId: editing.establishmentId, title: editing.title, phone: editing.phone } : { name: "", email: "", roleId: "assistant", establishmentId: db.establishments[0]?.id ?? "", title: "", phone: "" });
      setTempPwd("");
      setFormError("");
    }
  }, [modal.isOpen, editing, db.establishments]);

  const onSave = async () => {
    if (editing) {
      if (run(updateUser, { id: editing.id, patch: v }).ok) modal.closeModal();
      return;
    }
    if (!apiMode) {
      if (run(createUser, v).ok) modal.closeModal();
      return;
    }
    // Mode connecté : POST /api/accounts crée l'utilisateur ET son accès
    // (mot de passe temporaire à changer à la première connexion).
    setSaving(true);
    setFormError("");
    try {
      const res = await apiCreateAccount(v, v.email, tempPwd);
      if (res.ok) {
        toast.show("success", "Compte créé — communiquez le mot de passe temporaire à l'utilisateur.");
        await refresh();
        modal.closeModal();
      } else setFormError(res.error ?? "Création refusée par le serveur.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Création impossible (serveur injoignable).");
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    setResetError("");
    try {
      await apiResetPassword(resetTarget.id, resetPwd);
      toast.show("success", "Mot de passe réinitialisé — les sessions de ce compte ont été révoquées.");
      setResetTarget(null);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Réinitialisation impossible.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Utilisateurs" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => { setEditing(undefined); modal.openModal(); }}>Nouvel utilisateur</Button>} />
      {!apiMode && <DemoNotice>Comptes fictifs de démonstration. La désactivation n&apos;efface jamais l&apos;historique d&apos;un utilisateur. Aucune gestion réelle des mots de passe n&apos;est effectuée.</DemoNotice>}
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
                  {apiMode && u.id !== me?.id && <Button size="xs" variant="ghost" onClick={() => { setResetTarget(u); setResetPwd(""); setResetError(""); }}>Réinitialiser le mot de passe</Button>}
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
            <Button size="sm" onClick={() => void onSave()} disabled={saving || !v.name.trim() || !v.email.trim() || (!!apiMode && !editing && tempPwd.length < 10)}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
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
          {apiMode && !editing && <TextField label="Mot de passe temporaire (10 caractères min.)" type="password" value={tempPwd} onChange={setTempPwd} />}
        </FormGrid>
        {formError && <p className="mt-3 text-sm text-error-600">{formError}</p>}
        {apiMode && !editing && <p className="mt-3 text-theme-xs text-gray-500">L&apos;utilisateur devra choisir son propre mot de passe à sa première connexion.</p>}
      </AppModal>
      <ConfirmDialog isOpen={!!toggle} onClose={() => setToggle(null)} title={toggle?.active ? "Désactiver l'utilisateur" : "Réactiver l'utilisateur"} tone={toggle?.active ? "danger" : "primary"} message={toggle?.active ? "L'utilisateur ne pourra plus se connecter ; son historique (actes, validations, journal) est conservé." : "L'utilisateur pourra de nouveau se connecter."} reasonLabel="Motif" onConfirm={(reason) => (toggle ? run(setUserActive, { id: toggle.id, active: !toggle.active, reason }).ok : false)} />
      <AppModal isOpen={!!historyOf} onClose={() => setHistoryOf(null)} title={`Historique d'activité — ${historyOf?.name ?? ""}`} size="lg">
        {historyOf && <EntityHistory items={db.audit.filter((a) => a.userId === historyOf.id).map((a) => ({ date: a.date, label: `${a.module} — ${a.action}`, detail: a.target, userId: a.userId }))} auditTargets={[historyOf.name]} />}
      </AppModal>
      <AppModal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Réinitialiser le mot de passe — ${resetTarget?.name ?? ""}`}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
            <Button size="sm" onClick={() => void onReset()} disabled={resetting || resetPwd.length < 10}>{resetting ? "Réinitialisation…" : "Réinitialiser"}</Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Nouveau mot de passe temporaire (10 caractères min.)" type="password" value={resetPwd} onChange={setResetPwd} />
        </FormGrid>
        {resetError && <p className="mt-3 text-sm text-error-600">{resetError}</p>}
        <p className="mt-3 text-theme-xs text-gray-500">L&apos;utilisateur devra choisir son propre mot de passe à sa prochaine connexion ; ses sessions actives seront fermées.</p>
      </AppModal>
    </div>
  );
}
