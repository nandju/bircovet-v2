"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, NumberField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { PlusIcon } from "@/icons";
import { createEstablishment, updateEstablishment } from "@/lib/services/adminService";
import type { Establishment } from "@/lib/types";
import { useEffect, useState } from "react";

type Form = Omit<Establishment, "id" | "resources" | "locations" | "cages"> & { resources: string; locations: string; cages: string };

export default function EstablishmentsPage() {
  const { db, run, establishment, setEstablishment } = useDemo();
  const modal = useModal();
  const [editing, setEditing] = useState<Establishment | undefined>();
  const [v, setV] = useState<Form | null>(null);
  useEffect(() => {
    if (!modal.isOpen) return;
    const e = editing;
    setV({ name: e?.name ?? "BIRCOVET ", city: e?.city ?? "", address: e?.address ?? "", phone: e?.phone ?? "", email: e?.email ?? "", slotMinutes: e?.slotMinutes ?? 30, openingHours: e?.openingHours ?? "Lun–Ven 08:00–17:00", active: e?.active ?? true, resources: (e?.resources ?? ["Salle de consultation"]).join("\n"), locations: (e?.locations ?? ["Pharmacie"]).join("\n"), cages: (e?.cages ?? []).join("\n") });
  }, [modal.isOpen, editing]);
  const split = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const save = () => {
    if (!v) return;
    const data = { ...v, resources: split(v.resources), locations: split(v.locations), cages: split(v.cages) };
    if ((editing ? run(updateEstablishment, { id: editing.id, patch: data }) : run(createEstablishment, data)).ok) modal.closeModal();
  };
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Établissements" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => { setEditing(undefined); modal.openModal(); }}>Nouvel établissement</Button>} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {db.establishments.map((e) => (
          <ComponentCard
            key={e.id}
            title={e.name}
            desc={`${e.city}${e.active ? "" : " · inactif"}`}
            actions={
              <>
                {establishment?.id !== e.id && e.active && <Button size="xs" variant="soft" onClick={() => setEstablishment(e.id)}>Sélectionner</Button>}
                <Button size="xs" variant="outline" onClick={() => { setEditing(e); modal.openModal(); }}>Modifier</Button>
              </>
            }
          >
            <InfoGrid
              items={[
                { label: "Adresse", value: e.address, wide: true },
                { label: "Téléphone", value: e.phone },
                { label: "E-mail", value: e.email },
                { label: "Horaires", value: e.openingHours },
                { label: "Créneau par défaut", value: `${e.slotMinutes} min` },
                { label: "Ressources", value: e.resources.join(", "), wide: true },
                { label: "Emplacements de stock", value: e.locations.join(", "), wide: true },
                { label: "Emplacements d'hospitalisation", value: e.cages.join(", ") || "Aucun", wide: true },
              ]}
            />
          </ComponentCard>
        ))}
      </div>
      <AppModal
        isOpen={modal.isOpen}
        onClose={modal.closeModal}
        size="lg"
        title={editing ? `Modifier — ${editing.name}` : "Nouvel établissement"}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={modal.closeModal}>Annuler</Button>
            <Button size="sm" onClick={save}>Enregistrer</Button>
          </>
        }
      >
        {v && (
          <FormGrid>
            <TextField label="Nom" required value={v.name} onChange={(name) => setV({ ...v, name })} />
            <TextField label="Ville" value={v.city} onChange={(city) => setV({ ...v, city })} />
            <TextField label="Adresse" value={v.address} onChange={(address) => setV({ ...v, address })} className="sm:col-span-2" />
            <TextField label="Téléphone" value={v.phone} onChange={(phone) => setV({ ...v, phone })} />
            <TextField label="E-mail" value={v.email} onChange={(email) => setV({ ...v, email })} />
            <TextField label="Horaires" value={v.openingHours} onChange={(openingHours) => setV({ ...v, openingHours })} />
            <NumberField label="Durée de créneau par défaut" suffix="min" value={v.slotMinutes} onChange={(slotMinutes) => setV({ ...v, slotMinutes })} min={5} max={240} step={5} />
            <TextAreaField label="Ressources (une par ligne)" value={v.resources} onChange={(resources) => setV({ ...v, resources })} rows={3} />
            <TextAreaField label="Emplacements de stock (un par ligne)" value={v.locations} onChange={(locations) => setV({ ...v, locations })} rows={3} />
            <TextAreaField label="Emplacements d'hospitalisation (un par ligne)" value={v.cages} onChange={(cages) => setV({ ...v, cages })} rows={3} />
            <div className="flex items-end"><CheckField label="Établissement actif" checked={v.active} onChange={(active) => setV({ ...v, active })} /></div>
          </FormGrid>
        )}
      </AppModal>
    </div>
  );
}
