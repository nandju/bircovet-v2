"use client";

import EmptyState from "@/components/common/EmptyState";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { DownloadIcon, EyeIcon, FileIcon, PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import type { DocumentItem, EntityRef } from "@/lib/types";
import { useState } from "react";
import { DocumentPreviewModal, DocumentUploadModal } from "./DocumentModals";
import { downloadDocument } from "./docFiles";

/** Pièces jointes d'un dossier (client, patient, consultation, séjour, mission…). */
export default function LinkedDocuments({ refs, addTo }: { refs: EntityRef[]; addTo?: EntityRef }) {
  const { db, can } = useDemo();
  const upload = useModal();
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const docs = db.documents.filter((d) => refs.some((r) => r.kind === d.linked.kind && r.id === d.linked.id));
  return (
    <div className="space-y-3">
      {addTo && can("documents", "create") && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={upload.openModal}>
            Ajouter un document
          </Button>
        </div>
      )}
      {docs.length === 0 ? (
        <EmptyState title="Aucun document associé" description="Les comptes rendus, analyses et pièces jointes de ce dossier apparaîtront ici." icon={<FileIcon />} />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <FileIcon className="size-5 shrink-0 text-tertiary-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{d.title}</p>
                <p className="text-theme-xs text-gray-500">
                  v{d.version} · {formatDate(d.date)} · {userName(db, d.authorId)}
                </p>
              </div>
              <StatusBadge kind="docCategory" value={d.category} />
              {d.status === "archive" && <StatusBadge kind="doc" value="archive" />}
              <div className="flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => setPreview(d)} title="Consulter">
                  <EyeIcon className="size-4" />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => downloadDocument(d)} title="Télécharger (local)" disabled={!d.contentText && !d.localOnly}>
                  <DownloadIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {addTo && <DocumentUploadModal isOpen={upload.isOpen} onClose={upload.closeModal} linked={addTo} />}
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
