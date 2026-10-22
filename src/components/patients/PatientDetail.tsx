"use client";

import { AreaChart } from "@/components/charts/AppCharts";
import AccessDenied from "@/components/common/AccessDenied";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
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
import { ActivityIcon, AlertTriangleIcon, PencilIcon, PlusIcon, SyringeIcon, TransferIcon } from "@/icons";
import { clientName, productName, userName } from "@/lib/calc";
import { ageFrom, formatDate, formatDateTime } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { delivered, remaining } from "@/lib/services/prescriptionsService";
import { addPatientNote } from "@/lib/services/patientsService";
import { cn } from "@/utils";
import { useState } from "react";
import PatientFormModal from "./PatientFormModal";
import PatientMedia from "./PatientMedia";
import { DeathDialog, TransferModal, VaccinationModal, VitalModal } from "./PatientModals";

export default function PatientDetail({ id }: { id: string }) {
  const { db, run, user, today, can } = useDemo();
  const router = useRouter();
  const [tab, setTab] = useState("general");
  const edit = useModal();
  const vital = useModal();
  const vac = useModal();
  const transfer = useModal();
  const death = useModal();
  const p = db.patients.find((x) => x.id === id);
  if (!p) return <p className="text-sm text-gray-500">Patient introuvable.</p>;
  if (user?.roleId === "confrere" && !(user.sharedPatientIds ?? []).includes(p.id)) return <AccessDenied what="Ce dossier (non partagé)" />;

  const consultations = db.consultations.filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const prescriptions = db.prescriptions.filter((x) => x.patientId === p.id);
  const stays = db.hospitalizations.filter((h) => h.patientId === p.id);
  const lastVital = p.vitals[p.vitals.length - 1];
  const dead = p.vitalStatus === "decede";
  const readOnly = user?.roleId === "confrere";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={p.name}
        trail={[{ label: "Patients", href: "/patients" }]}
        actions={
          !readOnly && (
            <>
              <Can module="patients" action="update">
                <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={edit.openModal} disabled={dead}>
                  Modifier
                </Button>
                <Button size="sm" variant="outline" startIcon={<ActivityIcon />} onClick={vital.openModal} disabled={dead}>
                  Constantes
                </Button>
                <Button size="sm" variant="outline" startIcon={<TransferIcon />} onClick={transfer.openModal} disabled={dead}>
                  Cession
                </Button>
              </Can>
              {(user?.roleId === "dg" || user?.roleId === "vet") && !dead && (
                <Button size="sm" variant="ghost" className="text-error-600" onClick={death.openModal}>
                  Déclarer le décès
                </Button>
              )}
              <Can module="consultations" action="create">
                <Button size="sm" startIcon={<PlusIcon />} onClick={() => router.push(`/consultations/nouvelle?patient=${p.id}`)} disabled={dead}>
                  Consultation
                </Button>
              </Can>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 lg:grid-cols-[1fr_auto] dark:border-gray-800 dark:bg-white/3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{p.name}</p>
            <StatusBadge kind="vital" value={p.vitalStatus} />
            <span className="text-sm text-gray-500">
              {p.code} · {p.species} {p.breed} · {labelOf("sex", p.sex)} · {ageFrom(p.birthDate)}
              {p.birthDateEstimated && " (estimé)"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Propriétaire :{" "}
            {can("clients") ? (
              <Link href={`/clients/${p.ownerId}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                {clientName(db, p.ownerId)}
              </Link>
            ) : (
              clientName(db, p.ownerId)
            )}
          </p>
          {(p.allergies.length > 0 || p.alerts.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...p.allergies.map((a) => `Allergie : ${a}`), ...p.alerts].map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
                  <AlertTriangleIcon className="size-3.5" />
                  {a}
                </span>
              ))}
            </div>
          )}
          {dead && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Décès enregistré le {formatDate(p.deathDate)} — {p.deathReason}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[28rem]">
          {[
            ["Poids", lastVital ? `${lastVital.weightKg} kg` : "—"],
            ["Température", lastVital?.temperature ? `${lastVital.temperature} °C` : "—"],
            ["FC", lastVital?.heartRate ? `${lastVital.heartRate} bpm` : "—"],
            ["FR", lastVital?.respRate ? `${lastVital.respRate}/min` : "—"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-gray-50 p-3 dark:bg-white/3">
              <p className="text-theme-xs text-gray-500">{l}</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{v}</p>
            </div>
          ))}
          {lastVital && <p className="col-span-full text-[11px] text-gray-400">Dernière mesure : {formatDateTime(lastVital.date)} par {userName(db, lastVital.authorId)}</p>}
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Vue générale" },
          { key: "consultations", label: "Consultations", count: consultations.length },
          { key: "prescriptions", label: "Prescriptions", count: prescriptions.length },
          { key: "vaccins", label: "Vaccinations et rappels", count: p.vaccinations.length },
          { key: "hosp", label: "Hospitalisations", count: stays.length },
          { key: "media", label: "Photos et examens", count: p.photos.length + p.exams.length },
          { key: "docs", label: "Documents" },
          { key: "history", label: "Historique" },
        ]}
      />

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title="Identification">
            <InfoGrid
              items={[
                { label: "Identifiant", value: p.code },
                { label: "Naissance", value: `${formatDate(p.birthDate)}${p.birthDateEstimated ? " (estimée)" : ""}` },
                { label: "Robe", value: p.color },
                { label: "Puce électronique", value: p.chip },
                { label: "Passeport", value: p.passport },
                { label: "Assurance", value: p.insurance },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Évolution du poids">
            {p.vitals.length > 1 ? <AreaChart labels={p.vitals.map((v) => formatDate(v.date))} series={[{ name: "Poids (kg)", data: p.vitals.map((v) => v.weightKg) }]} height={200} /> : <p className="text-sm text-gray-500">Au moins deux mesures sont nécessaires.</p>}
          </ComponentCard>
          <ComponentCard title="Constantes datées">
            <DataTable
              rows={[...p.vitals].reverse()}
              rowKey={(v) => v.id}
              pageSize={5}
              dense
              columns={[
                { key: "d", header: "Date", primary: true, render: (v) => formatDateTime(v.date) },
                { key: "w", header: "Poids", render: (v) => `${v.weightKg} kg` },
                { key: "t", header: "T°", render: (v) => (v.temperature ? `${v.temperature} °C` : "—") },
                { key: "a", header: "Auteur", render: (v) => userName(db, v.authorId) },
              ]}
              emptyTitle="Aucune constante"
            />
          </ComponentCard>
          <ComponentCard title="Historique des propriétaires" desc="Conservé lors des cessions">
            <ul className="space-y-2">
              {[...p.ownerHistory].reverse().map((h, i) => (
                <li key={i} className={cn("rounded-lg border px-3 py-2 text-sm", !h.to ? "border-brand-200 bg-brand-25 dark:border-brand-800 dark:bg-brand-500/5" : "border-gray-100 dark:border-gray-800")}>
                  <span className="font-medium text-gray-800 dark:text-white/90">{clientName(db, h.clientId)}</span>
                  <span className="text-gray-500">
                    {" "}
                    · du {formatDate(h.from)} {h.to ? `au ${formatDate(h.to)}` : "à aujourd'hui"}
                  </span>
                  <p className="text-theme-xs text-gray-500">{h.reason}</p>
                </li>
              ))}
            </ul>
          </ComponentCard>
          {!readOnly && (
            <ComponentCard title="Notes cliniques et suivis" className="lg:col-span-2">
              <NotesPanel notes={p.notes} onAdd={(text) => run(addPatientNote, { patientId: p.id, text }).ok} canAdd={!dead && can("patients", "update")} />
            </ComponentCard>
          )}
        </div>
      )}

      {tab === "consultations" && (
        <ComponentCard title="Historique médical — consultations">
          <DataTable
            rows={readOnly ? consultations.filter((c) => c.status === "valide") : consultations}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/consultations/${c.id}`)}
            columns={[
              { key: "d", header: "Date", primary: true, sortValue: (c) => c.date, render: (c) => `${formatDate(c.date)} — ${c.code}` },
              { key: "r", header: "Motif", render: (c) => c.reason },
              { key: "dx", header: "Diagnostic", render: (c) => <span className="line-clamp-1">{c.diagnosis || "—"}</span>, hideOnMobile: true },
              { key: "v", header: "Responsable", render: (c) => userName(db, c.vetId) },
              { key: "s", header: "Statut clinique", render: (c) => <StatusBadge kind="clinical" value={c.status} /> },
            ]}
            emptyTitle="Aucune consultation"
          />
        </ComponentCard>
      )}

      {tab === "prescriptions" && (
        <ComponentCard title="Prescriptions" actions={<Link href="/prescriptions" className="text-sm font-medium text-brand-600">Prescriptions et délivrances</Link>}>
          <DataTable
            rows={prescriptions}
            rowKey={(x) => x.id}
            columns={[
              { key: "c", header: "Ordonnance", primary: true, render: (x) => `${x.code} — ${formatDate(x.date)}` },
              { key: "p", header: "Produit", render: (x) => productName(db, x.productId) },
              { key: "q", header: "Prescrit / délivré / reste", render: (x) => `${x.quantity} / ${delivered(x)} / ${remaining(x)}` },
              { key: "v", header: "Responsable", render: (x) => userName(db, x.vetId), hideOnMobile: true },
              { key: "s", header: "Statut", render: (x) => <StatusBadge kind="prescription" value={x.status} /> },
            ]}
            emptyTitle="Aucune prescription"
          />
        </ComponentCard>
      )}

      {tab === "vaccins" && (
        <ComponentCard
          title="Vaccinations et rappels"
          desc="Les échéances sont propres à chaque patient (aucune fréquence universelle)"
          actions={
            !readOnly &&
            !dead && (
              <Can module="patients" action="update">
                <Button size="sm" variant="outline" startIcon={<SyringeIcon />} onClick={vac.openModal}>
                  Enregistrer
                </Button>
              </Can>
            )
          }
        >
          <DataTable
            rows={p.vaccinations}
            rowKey={(v) => v.id}
            columns={[
              { key: "n", header: "Vaccin", primary: true, render: (v) => v.name },
              { key: "d", header: "Date", render: (v) => formatDate(v.date) },
              { key: "l", header: "Lot", render: (v) => v.lotRef ?? "—" },
              {
                key: "r",
                header: "Prochain rappel",
                render: (v) => (v.nextDue ? <span className={cn(v.nextDue < today && "font-medium text-error-600")}>{formatDate(v.nextDue)}{v.nextDue < today && " (dépassé)"}</span> : "Aucun"),
              },
              { key: "a", header: "Auteur", render: (v) => userName(db, v.authorId) },
            ]}
            emptyTitle="Aucune vaccination enregistrée"
          />
        </ComponentCard>
      )}

      {tab === "hosp" && (
        <ComponentCard title="Hospitalisations">
          <DataTable
            rows={stays}
            rowKey={(h) => h.id}
            onRowClick={(h) => router.push(`/hospitalisation/${h.id}`)}
            columns={[
              { key: "c", header: "Séjour", primary: true, render: (h) => h.code },
              { key: "a", header: "Admission", render: (h) => formatDateTime(h.admittedAt) },
              { key: "r", header: "Motif", render: (h) => h.reason },
              { key: "s", header: "Statut", render: (h) => <StatusBadge kind="hospitalization" value={h.status} /> },
            ]}
            emptyTitle="Aucune hospitalisation"
          />
        </ComponentCard>
      )}

      {tab === "media" && <PatientMedia patient={p} readOnly={readOnly} />}

      {tab === "docs" && (
        <ComponentCard title="Documents et pièces jointes">
          <LinkedDocuments refs={[{ kind: "patient", id: p.id }, ...consultations.map((c) => ({ kind: "consultation" as const, id: c.id })), ...stays.map((h) => ({ kind: "hospitalisation" as const, id: h.id }))]} addTo={readOnly ? undefined : { kind: "patient", id: p.id }} />
        </ComponentCard>
      )}

      {tab === "history" && (
        <ComponentCard title="Historique">
          <EntityHistory
            auditTargets={[p.code]}
            items={[
              { date: p.createdAt, label: "Création du dossier" },
              ...consultations.map((c) => ({ date: c.date, label: `Consultation ${c.code}`, detail: c.reason, userId: c.vetId })),
              ...p.vaccinations.map((v) => ({ date: v.date, label: `Vaccination — ${v.name}`, userId: v.authorId })),
              ...stays.map((h) => ({ date: h.admittedAt, label: `Admission ${h.code}`, detail: h.reason, userId: h.vetId })),
            ]}
          />
        </ComponentCard>
      )}

      <PatientFormModal isOpen={edit.isOpen} onClose={edit.closeModal} patient={p} />
      <VitalModal patient={p} isOpen={vital.isOpen} onClose={vital.closeModal} />
      <VaccinationModal patient={p} isOpen={vac.isOpen} onClose={vac.closeModal} />
      <TransferModal patient={p} isOpen={transfer.isOpen} onClose={transfer.closeModal} />
      <DeathDialog patient={p} isOpen={death.isOpen} onClose={death.closeModal} />
    </div>
  );
}
