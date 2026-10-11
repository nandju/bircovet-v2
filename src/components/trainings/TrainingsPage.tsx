"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { addDays, formatDate, formatXOF } from "@/lib/format";
import { createSession, createTraining, type SessionInput } from "@/lib/services/trainingsService";
import { cn } from "@/utils";
import { useState } from "react";

export default function TrainingsPage() {
  const { db, run, today } = useDemo();
  const router = useRouter();
  const sessionModal = useModal();
  const trainingModal = useModal();
  const [s, setS] = useState<SessionInput>({ trainingId: "", title: "", description: "", startDate: "", endDate: "", location: "", modality: "presentiel", capacity: 10, trainers: [], price: 0 });
  const [trainers, setTrainers] = useState("");
  const [t, setT] = useState({ title: "", description: "", category: "", durationDays: 1, defaultPrice: 0 });

  const openSession = () => {
    setS({ trainingId: "", title: "", description: "", startDate: addDays(today, 14), endDate: addDays(today, 14), location: "", modality: "presentiel", capacity: 10, trainers: [], price: 0 });
    setTrainers("");
    sessionModal.openModal();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Formations"
        actions={
          <Can module="formations" action="create">
            <Button size="sm" variant="outline" onClick={() => { setT({ title: "", description: "", category: "", durationDays: 1, defaultPrice: 0 }); trainingModal.openModal(); }}>Ajouter au catalogue</Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={openSession}>Nouvelle session</Button>
          </Can>
        }
      />
      <ComponentCard title="Catalogue des formations">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {db.trainings.map((tr) => (
            <div key={tr.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-theme-xs font-medium text-tertiary-600 uppercase dark:text-tertiary-400">{tr.category}</p>
              <p className="mt-1 font-medium text-gray-800 dark:text-white/90">{tr.title}</p>
              <p className="mt-1 text-sm text-gray-500">{tr.description}</p>
              <p className="mt-2 text-sm">{tr.durationDays} jour(s) · {formatXOF(tr.defaultPrice)} / participant</p>
            </div>
          ))}
        </div>
      </ComponentCard>
      <ComponentCard title="Sessions">
        <DataTable
          rows={db.sessions}
          rowKey={(x) => x.id}
          onRowClick={(x) => router.push(`/formations/${x.id}`)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "t", header: "Session", primary: true, render: (x) => <span className="flex flex-col"><span className="font-medium">{x.title}</span><span className="text-theme-xs text-gray-500">{x.code}</span></span> },
            { key: "d", header: "Dates", sortValue: (x) => x.startDate, render: (x) => `${formatDate(x.startDate)}${x.endDate !== x.startDate ? ` → ${formatDate(x.endDate)}` : ""}` },
            { key: "m", header: "Modalité", render: (x) => ({ presentiel: "Présentiel", distanciel: "Distanciel", terrain: "Terrain" })[x.modality] },
            { key: "c", header: "Inscrits / capacité", render: (x) => <span className={cn(x.participants.length >= x.capacity && "font-medium text-warning-600")}>{x.participants.length} / {x.capacity}</span> },
            { key: "p", header: "Tarif", align: "end", render: (x) => formatXOF(x.price), hideOnMobile: true },
            { key: "s", header: "Statut", render: (x) => <StatusBadge kind="session" value={x.status} /> },
          ]}
        />
      </ComponentCard>
      <AppModal
        isOpen={sessionModal.isOpen}
        onClose={sessionModal.closeModal}
        size="lg"
        title="Nouvelle session"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={sessionModal.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!s.trainingId || !s.title.trim()} onClick={() => { const r = run(createSession, { ...s, trainers: trainers.split(",").map((x) => x.trim()).filter(Boolean) }); if (r.ok && r.data) { sessionModal.closeModal(); router.push(`/formations/${r.data}`); } }}>Créer</Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Formation" required value={s.trainingId} onChange={(x) => { const tr = db.trainings.find((y) => y.id === x); setS({ ...s, trainingId: x, title: tr ? `${tr.title} — session` : s.title, description: tr?.description ?? "", price: tr?.defaultPrice ?? s.price }); }} options={db.trainings.map((tr) => ({ value: tr.id, label: tr.title }))} className="sm:col-span-2" />
          <TextField label="Titre" required value={s.title} onChange={(title) => setS({ ...s, title })} className="sm:col-span-2" />
          <TextField label="Début" type="date" value={s.startDate} onChange={(startDate) => setS({ ...s, startDate, endDate: s.endDate < startDate ? startDate : s.endDate })} />
          <TextField label="Fin" type="date" value={s.endDate} onChange={(endDate) => setS({ ...s, endDate })} />
          <SelectField label="Modalité" value={s.modality} onChange={(x) => setS({ ...s, modality: x as SessionInput["modality"] })} options={[{ value: "presentiel", label: "Présentiel" }, { value: "distanciel", label: "Distanciel" }, { value: "terrain", label: "Terrain" }]} />
          <TextField label="Lieu" value={s.location} onChange={(location) => setS({ ...s, location })} />
          <NumberField label="Capacité maximale" value={s.capacity} onChange={(capacity) => setS({ ...s, capacity })} min={1} />
          <NumberField label="Tarif par participant" suffix="FCFA" value={s.price} onChange={(price) => setS({ ...s, price })} min={0} step={1000} />
          <TextField label="Intervenants (séparés par des virgules)" value={trainers} onChange={setTrainers} className="sm:col-span-2" />
          <TextAreaField label="Description" value={s.description} onChange={(description) => setS({ ...s, description })} rows={2} className="sm:col-span-2" />
        </FormGrid>
      </AppModal>
      <AppModal
        isOpen={trainingModal.isOpen}
        onClose={trainingModal.closeModal}
        title="Ajouter une formation au catalogue"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={trainingModal.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!t.title.trim()} onClick={() => run(createTraining, t).ok && trainingModal.closeModal()}>Ajouter</Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Intitulé" required value={t.title} onChange={(title) => setT({ ...t, title })} className="sm:col-span-2" />
          <TextField label="Catégorie" value={t.category} onChange={(category) => setT({ ...t, category })} />
          <NumberField label="Durée" suffix="jours" value={t.durationDays} onChange={(durationDays) => setT({ ...t, durationDays })} min={1} />
          <NumberField label="Tarif par défaut" suffix="FCFA" value={t.defaultPrice} onChange={(defaultPrice) => setT({ ...t, defaultPrice })} min={0} />
          <TextAreaField label="Description" value={t.description} onChange={(description) => setT({ ...t, description })} rows={2} className="sm:col-span-2" />
        </FormGrid>
      </AppModal>
    </div>
  );
}
