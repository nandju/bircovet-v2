"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField, TextAreaField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { CheckLineIcon, DownloadIcon, TrashBinIcon, UploadIcon } from "@/icons";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { restoreBackup } from "@/lib/services/adminService";
import { clearSynced, resolveConflict, simulateRemoteConflict, synchronize } from "@/lib/services/syncService";
import { DEMO_PASSWORD } from "@/lib/seed/base";
import { useState } from "react";

export default function DemoPage() {
  const { db, session, run, switchUser, setOffline, resetDemo, logout, user } = useDemo();
  const router = useRouter();
  const [tab, setTab] = useState("profils");
  const [confirm, setConfirm] = useState<null | "logout" | "reset" | "backup" | "restore" | "clear">(null);
  const [restoreText, setRestoreText] = useState("");

  const queue = db.syncQueue;
  const pending = queue.filter((q) => q.status === "en_attente").length;
  const conflicts = queue.filter((q) => q.status === "conflit").length;
  const stats = [
    ["Utilisateurs", db.users.length], ["Établissements", db.establishments.length], ["Clients", db.clients.length], ["Patients", db.patients.length],
    ["Exploitations", db.farms.length], ["Rendez-vous", db.appointments.length], ["Consultations", db.consultations.length], ["Ordonnances", db.prescriptions.length],
    ["Hospitalisations", db.hospitalizations.length], ["Articles / lots", `${db.products.length} / ${db.lots.length}`], ["Mouvements de stock", db.movements.length],
    ["Factures / devis", `${db.invoices.length} / ${db.quotes.length}`], ["Encaissements", db.payments.length], ["Documents", db.documents.length],
    ["Entrées du journal", db.audit.length],
  ] as const;

  const doAction = () => {
    if (confirm === "logout") {
      logout();
      router.push("/signin");
    } else if (confirm === "reset") {
      resetDemo();
    } else if (confirm === "backup") {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cliva-sauvegarde-demo.json";
      a.click();
      URL.revokeObjectURL(url);
    } else if (confirm === "restore") {
      if (restoreText.trim()) run(restoreBackup, { json: restoreText });
    } else if (confirm === "clear") {
      run(clearSynced, undefined);
    }
    setConfirm(null);
    return true;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Environnement de démonstration" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} />
      <DemoNotice>
        Toutes les données sont fictives et conservées localement dans ce navigateur (localStorage versionné). Aucun serveur, compte bancaire, opérateur Mobile Money, service SMS/WhatsApp ou modèle d&apos;IA n&apos;est sollicité.
      </DemoNotice>
      <Tabs tabs={[{ key: "profils", label: "Profils de test" }, { key: "data", label: "Données de démonstration" }, { key: "offline", label: "Hors ligne et synchronisation", count: pending + conflicts }]} active={tab} onChange={setTab} />

      {tab === "profils" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {db.users.map((u) => (
              <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-theme-xs font-medium text-brand-600">{ROLE_LABELS[u.roleId]}</p>
                <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">{u.name}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="text-theme-xs text-gray-400">{u.title}{!u.active && " · désactivé"}</p>
                {session.userId === u.id ? (
                  <Button size="sm" variant="secondary" className="mt-3 w-full" startIcon={<CheckLineIcon />} disabled>Profil actif</Button>
                ) : (
                  <Button size="sm" variant="outline" className="mt-3 w-full" disabled={!u.active} onClick={() => { switchUser(u.id); router.push("/"); }}>Se connecter en tant que…</Button>
                )}
              </div>
            ))}
          </div>
          <DemoNotice>
            Comptes de démonstration — mot de passe fictif commun : <strong>{DEMO_PASSWORD}</strong>. Exemples : <strong>dg@cliva.demo</strong>, <strong>accueil@cliva.demo</strong>, <strong>vet@cliva.demo</strong>, <strong>comptable@cliva.demo</strong>.
          </DemoNotice>
          <Button variant="outline" onClick={() => setConfirm("logout")}>Se déconnecter</Button>
        </>
      )}

      {tab === "data" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
          <ComponentCard title="Inventaire des données fictives">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map(([l, v]) => (
                <div key={l} className="rounded-xl bg-gray-50 p-3 dark:bg-white/3">
                  <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{v}</p>
                  <p className="text-theme-xs text-gray-500">{l}</p>
                </div>
              ))}
            </div>
            <p className="text-theme-xs text-gray-500">Version du schéma : {db.schemaVersion} · jeu créé le {formatDateTime(db.seededAt)} · session : {user?.name}.</p>
          </ComponentCard>
          <ComponentCard title="Sauvegarde et réinitialisation">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => setConfirm("backup")}>Exporter la sauvegarde (JSON)</Button>
              <Button size="sm" variant="outline" startIcon={<UploadIcon />} onClick={() => { setRestoreText(""); setConfirm("restore"); }}>Importer une sauvegarde</Button>
              <Button size="sm" variant="danger" startIcon={<TrashBinIcon />} onClick={() => setConfirm("reset")}>Réinitialiser l&apos;environnement de démonstration</Button>
            </div>
            <p className="text-theme-xs text-gray-500">La réinitialisation restaure le jeu de données fictif initial et efface toutes vos modifications locales.</p>
            <TextAreaField label="Contenu JSON (import)" value={restoreText} onChange={setRestoreText} rows={4} />
          </ComponentCard>
        </div>
      )}

      {tab === "offline" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
          <ComponentCard title="Mode hors ligne (simulation)">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              État actuel : <StatusBadge kind="sync" value={session.offline ? "hors_ligne" : "en_ligne"} size="md" />
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant={session.offline ? "primary" : "outline"} onClick={() => setOffline(!session.offline)}>
                {session.offline ? "Revenir en ligne" : "Simuler le hors ligne"}
              </Button>
              <Button size="sm" variant="secondary" disabled={session.offline || pending === 0} onClick={() => run(synchronize, undefined)}>
                Synchroniser maintenant
              </Button>
            </div>
            <p className="text-theme-xs text-gray-500">En mode hors ligne, la lecture reste possible ; les écritures légères (notes patient/client, rapport de mission) sont mises en file et synchronisées sans doublon. Les validations sensibles (stock, finance) sont refusées hors ligne.</p>
          </ComponentCard>
          <ComponentCard title={`File d'attente (${queue.length})`} actions={queue.some((q) => q.status === "synchronise") && <Button size="xs" variant="ghost" onClick={() => setConfirm("clear")}>Nettoyer les synchronisées</Button>}>
            <DataTable
              rows={queue}
              rowKey={(q) => q.id}
              pageSize={8}
              columns={[
                { key: "d", header: "Créée", primary: true, sortValue: (q) => q.date, render: (q) => formatDateTime(q.date) },
                { key: "l", header: "Opération", render: (q) => q.label },
                { key: "s", header: "Statut", render: (q) => <StatusBadge kind="sync" value={q.status} /> },
                {
                  key: "x",
                  header: "Actions",
                  render: (q) => (
                    <span className="flex gap-1">
                      {q.status === "en_attente" && (
                        <Button size="xs" variant="ghost" title="Simuler une modification concurrente sur un autre poste" onClick={() => run(simulateRemoteConflict, { opId: q.id })}>
                          Simuler un conflit
                        </Button>
                      )}
                      {q.status === "conflit" && <ConflictResolver label={q.label} remote={q.conflict?.remoteText ?? ""} onResolve={(keep) => run(resolveConflict, { opId: q.id, keep })} />}
                    </span>
                  ),
                },
              ]}
              emptyTitle="File vide — tout est synchronisé"
            />
          </ComponentCard>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "reset" ? "Réinitialiser la démonstration" : confirm === "logout" ? "Se déconnecter" : confirm === "backup" ? "Exporter la sauvegarde" : confirm === "restore" ? "Importer la sauvegarde" : "Nettoyer la file de synchronisation"}
        tone={confirm === "reset" || confirm === "clear" ? "danger" : "primary"}
        message={confirm === "reset" ? "Toutes les données locales seront remplacées par le jeu fictif initial. Cette action est irréversible." : confirm === "restore" ? "Le contenu JSON collé remplacera les données actuelles de la démonstration (même version requise)." : confirm === "clear" ? "Les opérations déjà synchronisées seront retirées de la file." : ""}
        reasonLabel={confirm === "reset" ? "Motif (consigné au journal)" : undefined}
        onConfirm={doAction}
      />
    </div>
  );
}

function ConflictResolver({ label, remote, onResolve }: { label: string; remote: string; onResolve: (keep: "local" | "remote") => void }) {
  const [keep, setKeep] = useState<"local" | "remote">("local");
  return (
    <span className="flex flex-col gap-1 text-theme-xs">
      <span className="max-w-xs truncate text-gray-500" title={remote}>Version distante : {remote}</span>
      <span className="flex items-center gap-1">
        <span className="w-40">
          <SelectField label="" value={keep} onChange={(x) => setKeep(x as "local" | "remote")} options={[{ value: "local", label: "Garder la saisie hors ligne" }, { value: "remote", label: "Prendre la version distante" }]} />
        </span>
        <Button size="xs" variant="soft" onClick={() => onResolve(keep)}>Résoudre</Button>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
