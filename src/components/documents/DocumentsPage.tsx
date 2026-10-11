"use client";

import Can from "@/components/common/Can";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link } from "@/i18n/navigation";
import { ArchiveIcon, DownloadIcon, EyeIcon, PlusIcon, UploadIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDate, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { newDocumentVersion, setDocumentArchived } from "@/lib/services/documentsService";
import type { DemoDB, DocumentItem, EntityRef } from "@/lib/types";
import { useMemo, useRef, useState } from "react";
import { DocumentPreviewModal, DocumentUploadModal } from "./DocumentModals";
import { downloadDocument, formatSize, setLocalFile } from "./docFiles";

const KIND_LABEL: Record<string, string> = { client: "Client", patient: "Patient", consultation: "Consultation", hospitalisation: "Hospitalisation", mission: "Mission", exploitation: "Exploitation", autre: "Clinique" };

function linkOf(db: DemoDB, r: EntityRef): { label: string; href?: string } {
  switch (r.kind) {
    case "client":
      return { label: clientName(db, r.id), href: `/clients/${r.id}` };
    case "patient":
      return { label: patientName(db, r.id), href: `/patients/${r.id}` };
    case "consultation":
      return { label: db.consultations.find((c) => c.id === r.id)?.code ?? r.id, href: `/consultations/${r.id}` };
    case "hospitalisation":
      return { label: db.hospitalizations.find((h) => h.id === r.id)?.code ?? r.id, href: `/hospitalisation/${r.id}` };
    case "mission":
      return { label: db.missions.find((m) => m.id === r.id)?.code ?? r.id, href: `/missions/${r.id}` };
    case "exploitation":
      return { label: db.farms.find((f) => f.id === r.id)?.name ?? r.id, href: `/exploitations/${r.id}` };
    default:
      return { label: "Documentation interne" };
  }
}

export default function DocumentsPage() {
  const { db, run, user, can } = useDemo();
  const upload = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({ status: "actif" });
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [archive, setArchive] = useState<DocumentItem | null>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const [versionTarget, setVersionTarget] = useState<DocumentItem | null>(null);
  const shared = useMemo(() => (user?.roleId === "confrere" ? new Set(user.sharedPatientIds ?? []) : null), [user]);

  const rows = useMemo(() => {
    const t = normalize(q);
    return db.documents.filter(
      (d) =>
        (!shared || (d.linked.kind === "patient" && shared.has(d.linked.id))) &&
        (user?.roleId !== "comptable" || d.category === "administratif") &&
        (!f.category || d.category === f.category) &&
        (!f.status || d.status === f.status) &&
        (!f.kind || d.linked.kind === f.kind) &&
        (!t || normalize(`${d.title} ${d.fileName} ${d.contentText ?? ""} ${linkOf(db, d.linked).label}`).includes(t)),
    );
  }, [db, q, f, shared, user]);

  const linkOptions = useMemo(
    () => [
      ...db.patients.slice(0, 60).map((p) => ({ value: `patient:${p.id}`, label: `Patient — ${p.name} (${p.code})`, ref: { kind: "patient" as const, id: p.id } })),
      ...db.clients.map((c) => ({ value: `client:${c.id}`, label: `Client — ${c.name}`, ref: { kind: "client" as const, id: c.id } })),
      ...db.hospitalizations.map((h) => ({ value: `hosp:${h.id}`, label: `Hospitalisation — ${h.code}`, ref: { kind: "hospitalisation" as const, id: h.id } })),
      ...db.missions.map((m) => ({ value: `mis:${m.id}`, label: `Mission — ${m.code}`, ref: { kind: "mission" as const, id: m.id } })),
      ...db.farms.map((x) => ({ value: `farm:${x.id}`, label: `Exploitation — ${x.name}`, ref: { kind: "exploitation" as const, id: x.id } })),
    ],
    [db],
  );

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Bibliothèque documentaire"
        subtitle={`${rows.length} document(s)`}
        actions={
          <Can module="documents" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={upload.openModal}>Ajouter un document</Button>
          </Can>
        }
      />
      <DemoNotice>Exemples fictifs (rapports, analyses, radiographies illustratives, comptes rendus). Aucun lien public n&apos;est généré ; les fichiers choisis restent temporairement dans ce navigateur.</DemoNotice>
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Titre, contenu, dossier…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "category", label: "Toutes catégories", options: optionsOf("docCategory") },
            { key: "kind", label: "Tous dossiers", options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })) },
            { key: "status", label: "Tous statuts", options: optionsOf("doc") },
          ]}
        />
        <DataTable
          rows={rows}
          rowKey={(d) => d.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "t", header: "Document", primary: true, render: (d) => <span className="flex flex-col"><span className="font-medium">{d.title}</span><span className="text-theme-xs text-gray-500">{d.fileName} · {formatSize(d.size)}{d.localOnly && " · fichier local temporaire"}</span></span> },
            { key: "c", header: "Catégorie", render: (d) => <StatusBadge kind="docCategory" value={d.category} /> },
            { key: "l", header: "Dossier associé", render: (d) => { const l = linkOf(db, d.linked); return <span className="text-theme-xs"><span className="text-gray-500">{KIND_LABEL[d.linked.kind]} · </span>{l.href ? <Link href={l.href} className="text-brand-600 hover:underline">{l.label}</Link> : l.label}</span>; } },
            { key: "d", header: "Date", sortValue: (d) => d.date, render: (d) => formatDate(d.date) },
            { key: "v", header: "Version", align: "center", render: (d) => `v${d.version}` },
            { key: "a", header: "Auteur", hideOnMobile: true, render: (d) => userName(db, d.authorId) },
            { key: "s", header: "Statut", render: (d) => <StatusBadge kind="doc" value={d.status} /> },
            {
              key: "x",
              header: "Actions",
              render: (d) => (
                <span className="flex gap-0.5">
                  <Button size="xs" variant="ghost" onClick={() => setPreview(d)} title="Consulter"><EyeIcon className="size-4" /></Button>
                  <Button size="xs" variant="ghost" onClick={() => downloadDocument(d)} title="Télécharger (local)" disabled={!d.contentText && !d.localOnly}><DownloadIcon className="size-4" /></Button>
                  {can("documents", "create") && d.status === "actif" && (
                    <Button size="xs" variant="ghost" title="Nouvelle version" onClick={() => { setVersionTarget(d); versionInput.current?.click(); }}><UploadIcon className="size-4" /></Button>
                  )}
                  {can("documents", "create") && <Button size="xs" variant="ghost" title={d.status === "actif" ? "Archiver" : "Restaurer"} onClick={() => setArchive(d)}><ArchiveIcon className="size-4" /></Button>}
                </span>
              ),
            },
          ]}
          emptyTitle="Aucun document"
        />
      </Panel>
      <input
        ref={versionInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && versionTarget) {
            if (run(newDocumentVersion, { id: versionTarget.id, fileName: file.name, size: file.size, mimeType: file.type || "application/octet-stream", localOnly: true }).ok) setLocalFile(versionTarget.id, file);
          }
          e.target.value = "";
        }}
      />
      <DocumentUploadModal isOpen={upload.isOpen} onClose={upload.closeModal} linkOptions={linkOptions} />
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog isOpen={!!archive} onClose={() => setArchive(null)} title={archive?.status === "actif" ? "Archiver le document" : "Restaurer le document"} message="Le document reste conservé et consultable dans les archives." onConfirm={() => (archive ? run(setDocumentArchived, { id: archive.id, archived: archive.status === "actif" }).ok : false)} />
    </div>
  );
}
