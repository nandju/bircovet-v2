"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import InfoGrid from "@/components/common/InfoGrid";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { FileIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { addDocument } from "@/lib/services/documentsService";
import type { DocCategory, DocumentItem, EntityRef } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { downloadDocument, formatSize, getLocalFile, setLocalFile } from "./docFiles";

export function DocumentUploadModal({ isOpen, onClose, linked, linkOptions }: { isOpen: boolean; onClose: () => void; linked?: EntityRef; linkOptions?: { value: string; label: string; ref: EntityRef }[] }) {
  const { run } = useDemo();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocCategory>("compte_rendu");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setFile(null);
      setNote("");
      setLink("");
    }
  }, [isOpen]);
  const target = linked ?? linkOptions?.find((o) => o.value === link)?.ref;

  const save = () => {
    if (!target) return;
    const r = run(addDocument, {
      title: title || file?.name || "Document",
      category,
      linked: target,
      fileName: file?.name ?? `${(title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`,
      mimeType: file?.type || "text/plain",
      size: file?.size ?? note.length * 2,
      contentText: file ? undefined : note,
      localOnly: !!file,
    });
    if (r.ok && r.data && file) setLocalFile(r.data, file);
    if (r.ok) onClose();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajouter un document"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!target || (!file && !note.trim())}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>Le fichier sélectionné reste dans ce navigateur (URL temporaire, non persistée, jamais publiée). Seules les métadonnées sont enregistrées. Le stockage sécurisé sera fourni par le backend.</DemoNotice>
        <FormGrid>
          <TextField label="Titre" value={title} onChange={setTitle} className="sm:col-span-2" />
          <SelectField label="Catégorie" value={category} onChange={(v) => setCategory(v as DocCategory)} options={optionsOf("docCategory")} />
          {linkOptions && <SelectField label="Dossier associé" required value={link} onChange={setLink} options={linkOptions} />}
        </FormGrid>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fichier (optionnel)</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 file:me-4 file:cursor-pointer file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-brand-700 dark:border-gray-700 dark:text-gray-400 dark:file:bg-brand-500/15 dark:file:text-brand-300"
          />
        </div>
        {!file && <TextAreaField label="Ou contenu texte (compte rendu fictif)" value={note} onChange={setNote} rows={4} />}
      </div>
    </AppModal>
  );
}

export function DocumentPreviewModal({ doc, onClose }: { doc: DocumentItem | null; onClose: () => void }) {
  const { db } = useDemo();
  const file = doc ? getLocalFile(doc.id) : undefined;
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  if (!doc) return null;
  return (
    <AppModal
      isOpen={!!doc}
      onClose={onClose}
      title={doc.title}
      size="lg"
      footer={
        <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)} disabled={!file && !doc.contentText}>
          Télécharger (local)
        </Button>
      }
    >
      <div className="space-y-4">
        <InfoGrid
          cols={4}
          items={[
            { label: "Catégorie", value: <StatusBadge kind="docCategory" value={doc.category} /> },
            { label: "Version", value: `v${doc.version}` },
            { label: "Date", value: formatDate(doc.date) },
            { label: "Auteur", value: userName(db, doc.authorId) },
            { label: "Fichier", value: `${doc.fileName} · ${formatSize(doc.size)}` },
            { label: "Statut", value: <StatusBadge kind="doc" value={doc.status} /> },
          ]}
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3">
          {url && file?.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.title} className="mx-auto max-h-[50vh] rounded-lg" />
          ) : url && file?.type === "application/pdf" ? (
            <iframe src={url} title={doc.title} className="h-[50vh] w-full rounded-lg" />
          ) : doc.contentText ? (
            <pre className="font-outfit text-sm whitespace-pre-wrap text-gray-800 dark:text-white/90">{doc.contentText}</pre>
          ) : doc.mimeType.startsWith("image/") ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg bg-gray-900 text-center text-sm text-gray-300">
              <FileIcon className="size-8" />
              Image illustrative (aucune image réelle stockée dans la démonstration)
            </div>
          ) : (
            <p className="text-sm text-gray-500">Prévisualisation indisponible : le fichier n&apos;est plus présent dans ce navigateur (il sera stocké côté serveur après intégration).</p>
          )}
        </div>
      </div>
    </AppModal>
  );
}
