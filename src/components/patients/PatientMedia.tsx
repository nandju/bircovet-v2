"use client";

import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/common/EmptyState";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { formatDate } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { addPatientExam, addPatientPhoto, removePatientPhoto } from "@/lib/services/patientsService";
import { userName } from "@/lib/calc";
import type { ExamType, Patient } from "@/lib/types";
import { useState } from "react";

const MAX_PHOTO_SIZE = 700 * 1024; // 700 Ko — photos persistées en data URL (démo locale)

/** Photos et examens complémentaires du dossier patient. */
export default function PatientMedia({ patient, readOnly }: { patient: Patient; readOnly: boolean }) {
  const { db, run, can } = useDemo();
  const photoModal = useModal();
  const examModal = useModal();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<{ dataUrl: string; name: string } | null>(null);
  const [fileError, setFileError] = useState("");
  const [exam, setExam] = useState({ type: "radiographie" as ExamType, label: "", result: "", fileName: "" });
  const canEdit = !readOnly && can("patients", "update") && patient.vitalStatus !== "decede";

  const onFile = (f: File | undefined) => {
    setFileError("");
    setFile(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setFileError("Image requise (PNG, JPG, WebP).");
    if (f.size > MAX_PHOTO_SIZE) return setFileError("Image trop volumineuse : 700 Ko maximum en démonstration.");
    const reader = new FileReader();
    reader.onload = () => setFile({ dataUrl: String(reader.result), name: f.name });
    reader.readAsDataURL(f);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <ComponentCard
        title="Photos du patient"
        actions={
          canEdit && (
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={photoModal.openModal}>
              Ajouter
            </Button>
          )
        }
      >
        {patient.photos.length === 0 ? (
          <EmptyState title="Aucune photo" description="Ajoutez des photos de l'animal pour suivre son évolution." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {patient.photos.map((ph) => (
              <figure key={ph.id} className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element -- photos du dossier (data URL locale) */}
                <img src={ph.dataUrl} alt={ph.caption || patient.name} className="aspect-square w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-theme-xs text-gray-500">{ph.caption || "Photo"} · {formatDate(ph.date)}</span>
                  {canEdit && (
                    <button type="button" onClick={() => run(removePatientPhoto, { patientId: patient.id, photoId: ph.id })} className="rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-error-500" aria-label="Supprimer">
                      <TrashBinIcon className="size-3.5" />
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </ComponentCard>

      <ComponentCard
        title="Examens complémentaires"
        desc="Radiographie, échographie, biochimie, hématologie, endoscopie, cytologie…"
        actions={
          canEdit && (
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={examModal.openModal}>
              Consigner
            </Button>
          )
        }
      >
        <DataTable
          rows={patient.exams}
          rowKey={(e) => e.id}
          pageSize={6}
          dense
          columns={[
            { key: "d", header: "Date", primary: true, render: (e) => formatDate(e.date) },
            { key: "t", header: "Type", render: (e) => <StatusBadge kind="examType" value={e.type} /> },
            { key: "l", header: "Examen", render: (e) => <span>{e.label}{e.fileName ? <span className="block text-theme-xs text-gray-400">Pièce : {e.fileName}</span> : null}</span> },
            { key: "r", header: "Résultat", render: (e) => <span className="line-clamp-2">{e.result || "—"}</span> },
            { key: "a", header: "Par", render: (e) => userName(db, e.authorId), hideOnMobile: true },
          ]}
          emptyTitle="Aucun examen consigné"
        />
        <p className="mt-2 text-theme-xs text-gray-400">Les fichiers joints sont référencés par nom ; en production ils seront téléversés côté serveur avec contrôle d&apos;accès.</p>
      </ComponentCard>

      <Modal isOpen={photoModal.isOpen} onClose={photoModal.closeModal} className="max-w-md p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Ajouter une photo</h3>
        <div className="space-y-4">
          <div>
            <label className="block cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 hover:border-brand-300 dark:border-gray-700">
              {file ? file.name : "Sélectionner une image…"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {fileError && <p className="mt-1 text-theme-xs text-error-500">{fileError}</p>}
            {file && (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu avant validation
              <img src={file.dataUrl} alt="Aperçu" className="mt-2 size-24 rounded-lg object-cover" />
            )}
          </div>
          <TextField label="Légende" value={caption} onChange={setCaption} placeholder="Ex. lésion oreille gauche, avant traitement" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={photoModal.closeModal}>Annuler</Button>
            <Button disabled={!file} onClick={() => { if (file && run(addPatientPhoto, { patientId: patient.id, dataUrl: file.dataUrl, caption }).ok) { photoModal.closeModal(); setFile(null); setCaption(""); } }}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={examModal.isOpen} onClose={examModal.closeModal} className="max-w-md p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Consigner un examen complémentaire</h3>
        <FormGrid>
          <SelectField label="Type d'examen" value={exam.type} onChange={(x) => setExam((s) => ({ ...s, type: x as ExamType }))} options={optionsOf("examType")} />
          <TextField label="Intitulé" value={exam.label} onChange={(x) => setExam((s) => ({ ...s, label: x }))} placeholder="Ex. radio thorax, NFS…" />
          <TextAreaField label="Résultat / interprétation" value={exam.result} onChange={(x) => setExam((s) => ({ ...s, result: x }))} rows={3} className="sm:col-span-2" />
          <TextField label="Pièce jointe (nom du fichier)" value={exam.fileName} onChange={(x) => setExam((s) => ({ ...s, fileName: x }))} placeholder="Ex. radio-thorax-2026.pdf" />
        </FormGrid>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={examModal.closeModal}>Annuler</Button>
          <Button disabled={!exam.label.trim()} onClick={() => { if (run(addPatientExam, { patientId: patient.id, ...exam, fileName: exam.fileName || undefined }).ok) { examModal.closeModal(); setExam({ type: "radiographie", label: "", result: "", fileName: "" }); } }}>Consigner</Button>
        </div>
      </Modal>
    </div>
  );
}
