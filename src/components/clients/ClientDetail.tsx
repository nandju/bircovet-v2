"use client";

import AvatarInitials from "@/components/common/AvatarInitials";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import EntityHistory from "@/components/common/EntityHistory";
import InfoGrid from "@/components/common/InfoGrid";
import NotesPanel from "@/components/common/NotesPanel";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import LinkedDocuments from "@/components/documents/LinkedDocuments";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link, useRouter } from "@/i18n/navigation";
import { ArchiveIcon, PencilIcon, PlusIcon } from "@/icons";
import { clientCreditBalance, clientOutstanding, docTotal, invoiceBalance, patientName, receivablePaid, userName } from "@/lib/calc";
import { ageFrom, formatDate, formatDateTime, formatXOF } from "@/lib/format";
import { addClientNote, findDuplicates, setClientArchived } from "@/lib/services/clientsService";
import { useState } from "react";

export default function ClientDetail({ id }: { id: string }) {
  const { db, run } = useDemo();
  const router = useRouter();
  const [tab, setTab] = useState("general");
  const archive = useModal();
  const c = db.clients.find((x) => x.id === id);
  if (!c) return <p className="text-sm text-gray-500">Client introuvable.</p>;

  const patients = db.patients.filter((p) => p.ownerId === c.id);
  const formerPatients = db.patients.filter((p) => p.ownerId !== c.id && p.ownerHistory.some((h) => h.clientId === c.id));
  const appts = db.appointments.filter((a) => a.clientId === c.id).sort((a, b) => b.start.localeCompare(a.start));
  const invoices = db.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const payments = db.payments.filter((p) => p.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const receivables = db.openingReceivables.filter((r) => r.clientId === c.id);
  const farms = db.farms.filter((f) => f.clientId === c.id);
  const dups = findDuplicates(db, c);
  const outstanding = clientOutstanding(db, c.id);
  const credit = clientCreditBalance(db, c.id);
  const mergedInto = c.mergedIntoId ? db.clients.find((x) => x.id === c.mergedIntoId) : undefined;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={c.name}
        trail={[{ label: "Clients", href: "/clients" }]}
        actions={
          <>
            <Can module="clients" action="update">
              <Button size="sm" variant="outline" startIcon={<ArchiveIcon />} onClick={archive.openModal}>
                {c.status === "archive" ? "Restaurer" : "Archiver"}
              </Button>
              <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={() => router.push(`/clients/${c.id}/modifier`)} disabled={c.status === "archive"}>
                Modifier
              </Button>
            </Can>
            <Can module="patients" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={() => router.push(`/patients?nouveau=1&client=${c.id}`)} disabled={c.status === "archive"}>
                Ajouter un patient
              </Button>
            </Can>
          </>
        }
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5 dark:border-gray-800 dark:bg-white/3">
        <AvatarInitials name={c.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{c.name}</p>
            <StatusBadge kind="clientType" value={c.type} />
            <StatusBadge kind="segment" value={c.segment} />
            <StatusBadge kind="client" value={c.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {c.code} · {c.phoneCode} {c.phone} {c.email && `· ${c.email}`}
          </p>
          {mergedInto && (
            <p className="mt-1 text-sm text-warning-700 dark:text-warning-400">
              Fiche fusionnée dans{" "}
              <Link className="underline" href={`/clients/${mergedInto.id}`}>
                {mergedInto.name}
              </Link>
            </p>
          )}
          {dups.length > 0 && (
            <p className="mt-1 text-sm text-warning-700 dark:text-warning-400">
              Doublon potentiel : {dups.map((d) => d.name).join(", ")} —{" "}
              <Link href="/clients/fusion" className="underline">
                fusion supervisée
              </Link>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">Impayés</p>
            <p className={`text-base font-semibold ${outstanding > 0 ? "text-error-600 dark:text-error-400" : "text-gray-800 dark:text-white/90"}`}>{formatXOF(outstanding)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">Avoir / acompte</p>
            <p className="text-base font-semibold text-gray-800 dark:text-white/90">{formatXOF(credit)}</p>
          </div>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Vue générale" },
          { key: "patients", label: "Patients", count: patients.length },
          { key: "rdv", label: "Rendez-vous", count: appts.length },
          { key: "finance", label: "Factures et paiements", count: invoices.length },
          { key: "notes", label: "Notes et suivis", count: c.notes.length },
          { key: "docs", label: "Documents" },
          { key: "history", label: "Historique" },
        ]}
      />

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title="Coordonnées">
            <InfoGrid
              items={[
                { label: "Identifiant", value: c.code },
                { label: "Type", value: <StatusBadge kind="clientType" value={c.type} /> },
                { label: "Téléphone", value: `${c.phoneCode} ${c.phone}` },
                { label: "E-mail", value: c.email },
                { label: "Ville", value: c.city },
                { label: "Adresse", value: c.address },
                { label: "Client depuis", value: formatDate(c.createdAt) },
                { label: "Dernière activité", value: formatDate(c.lastActivityAt) },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Payeur et communication">
            <InfoGrid
              items={[
                { label: "Payeur", value: c.payerName },
                { label: "N° contribuable (fictif)", value: c.payerTaxId },
                {
                  label: "Préférences",
                  wide: true,
                  value: [c.commPrefs.sms && "SMS", c.commPrefs.whatsapp && "WhatsApp", c.commPrefs.email && "E-mail", c.commPrefs.call && "Appel"].filter(Boolean).join(", ") || "Aucune",
                },
                { label: "Contacts complémentaires", wide: true, value: c.contacts.length ? c.contacts.map((x) => `${x.name} (${x.relation}) — ${x.phone}`).join(" ; ") : "Aucun" },
                { label: "Exploitations", wide: true, value: farms.length ? farms.map((f) => <Link key={f.id} href={`/exploitations/${f.id}`} className="me-2 text-brand-600 underline">{f.name}</Link>) : "Aucune" },
              ]}
            />
          </ComponentCard>
        </div>
      )}

      {tab === "patients" && (
        <ComponentCard title="Patients associés" desc={formerPatients.length ? `${formerPatients.length} ancien(s) animal(aux) cédé(s) conservé(s) dans l'historique` : undefined}>
          <DataTable
            rows={[...patients, ...formerPatients]}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/patients/${p.id}`)}
            columns={[
              { key: "n", header: "Nom", primary: true, render: (p) => <span className="font-medium">{p.name} {p.ownerId !== c.id && <span className="text-theme-xs text-gray-500">(cédé)</span>}</span> },
              { key: "s", header: "Espèce / race", render: (p) => `${p.species} — ${p.breed}` },
              { key: "a", header: "Âge", render: (p) => ageFrom(p.birthDate) },
              { key: "v", header: "Statut", render: (p) => <StatusBadge kind="vital" value={p.vitalStatus} /> },
            ]}
            emptyTitle="Aucun patient"
          />
        </ComponentCard>
      )}

      {tab === "rdv" && (
        <ComponentCard title="Historique des rendez-vous">
          <DataTable
            rows={appts}
            rowKey={(a) => a.id}
            columns={[
              { key: "d", header: "Date", primary: true, sortValue: (a) => a.start, render: (a) => formatDateTime(a.start) },
              { key: "p", header: "Patient", render: (a) => patientName(db, a.patientId) },
              { key: "r", header: "Motif", render: (a) => a.reason },
              { key: "w", header: "Intervenant", render: (a) => userName(db, a.practitionerId) },
              { key: "s", header: "Statut", render: (a) => <StatusBadge kind="appointment" value={a.status} /> },
            ]}
            emptyTitle="Aucun rendez-vous"
          />
        </ComponentCard>
      )}

      {tab === "finance" && (
        <div className="space-y-4">
          <ComponentCard title="Factures et avoirs">
            <DataTable
              rows={invoices}
              rowKey={(i) => i.id}
              onRowClick={(i) => router.push(`/facturation/factures/${i.id}`)}
              columns={[
                { key: "c", header: "N°", primary: true, render: (i) => <span className="font-medium">{i.code}</span> },
                { key: "d", header: "Date", sortValue: (i) => i.date, render: (i) => formatDate(i.date) },
                { key: "t", header: "Total", align: "end", render: (i) => (i.kind === "avoir" ? `− ${formatXOF(docTotal(i.lines))}` : formatXOF(docTotal(i.lines))) },
                { key: "b", header: "Solde", align: "end", render: (i) => (i.kind === "avoir" ? "—" : formatXOF(invoiceBalance(db, i))) },
                { key: "s", header: "Statut", render: (i) => <StatusBadge kind="invoice" value={i.status} /> },
              ]}
              emptyTitle="Aucune facture"
            />
          </ComponentCard>
          <ComponentCard title="Paiements">
            <DataTable
              rows={payments}
              rowKey={(p) => p.id}
              columns={[
                { key: "c", header: "Réf.", primary: true, render: (p) => p.code },
                { key: "d", header: "Date", render: (p) => formatDate(p.date) },
                { key: "m", header: "Moyen", render: (p) => <StatusBadge kind="paymentMethod" value={p.method} /> },
                { key: "k", header: "Nature", render: (p) => <StatusBadge kind="paymentKind" value={p.kind} /> },
                { key: "a", header: "Montant", align: "end", render: (p) => formatXOF(p.amount) },
              ]}
              emptyTitle="Aucun paiement"
            />
          </ComponentCard>
          {receivables.length > 0 && (
            <ComponentCard title="Créances antérieures (soldes d'ouverture)" desc="Distinctes des ventes nouvelles">
              {receivables.map((r) => (
                <div key={r.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    {r.code} — {r.label} ({formatDate(r.originDate)})
                  </span>
                  <span className="font-medium">
                    reste {formatXOF(r.amount - receivablePaid(db, r.id))} / {formatXOF(r.amount)}
                  </span>
                </div>
              ))}
            </ComponentCard>
          )}
        </div>
      )}

      {tab === "notes" && (
        <ComponentCard title="Notes et suivis">
          <NotesPanel notes={c.notes} onAdd={(text) => run(addClientNote, { id: c.id, text }).ok} />
        </ComponentCard>
      )}

      {tab === "docs" && (
        <ComponentCard title="Documents associés">
          <LinkedDocuments refs={[{ kind: "client", id: c.id }, ...patients.map((p) => ({ kind: "patient" as const, id: p.id }))]} addTo={{ kind: "client", id: c.id }} />
        </ComponentCard>
      )}

      {tab === "history" && (
        <ComponentCard title="Historique">
          <EntityHistory
            auditTargets={[c.code]}
            items={[
              { date: c.createdAt, label: "Création de la fiche" },
              ...db.interactions.filter((i) => i.clientId === c.id).map((i) => ({ date: i.date, label: `Interaction (${i.channel})`, detail: i.summary, userId: i.userId })),
              ...payments.map((p) => ({ date: p.date, label: `Paiement ${p.code}`, detail: formatXOF(p.amount), userId: p.userId })),
            ]}
          />
        </ComponentCard>
      )}

      <ConfirmDialog
        isOpen={archive.isOpen}
        onClose={archive.closeModal}
        title={c.status === "archive" ? "Restaurer le client" : "Archiver le client"}
        message={c.status === "archive" ? "La fiche redeviendra active." : "Suppression logique : la fiche et son historique restent consultables, mais le client n'apparaît plus dans les listes actives."}
        tone={c.status === "archive" ? "primary" : "danger"}
        reasonLabel="Motif"
        confirmLabel={c.status === "archive" ? "Restaurer" : "Archiver"}
        onConfirm={(reason) => run(setClientArchived, { id: c.id, archived: c.status !== "archive", reason }).ok}
      />
    </div>
  );
}
