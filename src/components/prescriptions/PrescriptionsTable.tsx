"use client";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { lotRef, patientName, productName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLINICAL_VALIDATORS } from "@/lib/permissions";
import { cancelPrescription, delivered, remaining, submitPrescription, validatePrescription } from "@/lib/services/prescriptionsService";
import type { Prescription } from "@/lib/types";
import { useState } from "react";

/** Tableau des prescriptions : prescrit / délivré / reste, lots utilisés, actions selon le profil. */
export default function PrescriptionsTable({ rows, onDeliver, showPatient }: { rows: Prescription[]; onDeliver: (p: Prescription) => void; showPatient?: boolean }) {
  const { db, run, user, can } = useDemo();
  const [cancel, setCancel] = useState<Prescription | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const validator = !!user && CLINICAL_VALIDATORS.includes(user.roleId);
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => setOpen(open === p.id ? null : p.id)}
        initialSort={{ key: "d", dir: "desc" }}
        emptyTitle="Aucune prescription"
        columns={[
          { key: "d", header: "Ordonnance", primary: true, sortValue: (p) => p.date, render: (p) => <span className="flex flex-col"><span className="font-medium">{p.code}</span><span className="text-theme-xs text-gray-500">{formatDate(p.date)}</span></span> },
          ...(showPatient ? [{ key: "pt", header: "Patient", render: (p: Prescription) => patientName(db, p.patientId) }] : []),
          {
            key: "p",
            header: "Produit",
            render: (p) => (
              <span>
                {productName(db, p.productId)}
                {open === p.id && (
                  <span className="mt-1 block text-theme-xs text-gray-500">
                    {p.form} · {p.route} · dose : {p.dose} · {p.frequency} · {p.duration}
                    {p.deliveries.map((d) => (
                      <span key={d.id} className="block">
                        ↳ {formatDateTime(d.date)} — {d.kind} {d.qty} ({d.allocations.map((a) => `${lotRef(db, a.lotId)}×${a.qty}`).join(", ")}) par {userName(db, d.userId)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            ),
          },
          { key: "q", header: "Prescrit", align: "center", render: (p) => p.quantity },
          { key: "dl", header: "Délivré", align: "center", render: (p) => delivered(p) },
          { key: "r", header: "Reste", align: "center", render: (p) => <strong className={remaining(p) > 0 && p.status !== "annulee" ? "text-warning-600" : ""}>{remaining(p)}</strong> },
          { key: "lots", header: "Lots utilisés", hideOnMobile: true, render: (p) => Array.from(new Set(p.deliveries.flatMap((d) => d.allocations.map((a) => lotRef(db, a.lotId))))).join(", ") || "—" },
          { key: "v", header: "Responsable", hideOnMobile: true, render: (p) => `${userName(db, p.vetId)}${p.authorId !== p.vetId ? ` (saisie ${userName(db, p.authorId)})` : ""}` },
          { key: "s", header: "Statut", render: (p) => <StatusBadge kind="prescription" value={p.status} /> },
          {
            key: "a",
            header: "Actions",
            render: (p) => (
              <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                {p.status === "brouillon" && can("prescriptions", "create") && (
                  <Button size="xs" variant="outline" onClick={() => run(submitPrescription, { id: p.id })}>
                    Soumettre
                  </Button>
                )}
                {(p.status === "brouillon" || p.status === "a_valider") && validator && (
                  <Button size="xs" variant="soft" onClick={() => run(validatePrescription, { id: p.id })}>
                    Valider
                  </Button>
                )}
                {(p.status === "validee" || p.status === "partiellement_delivree") && can("prescriptions", "update") && (
                  <Button size="xs" onClick={() => onDeliver(p)}>
                    Délivrer
                  </Button>
                )}
                {validator && p.status !== "annulee" && p.status !== "delivree" && (
                  <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setCancel(p)}>
                    Annuler
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />
      <ConfirmDialog isOpen={!!cancel} onClose={() => setCancel(null)} title="Annuler la prescription" tone="danger" message="Les délivrances déjà réalisées restent tracées ; le reliquat ne sera plus délivrable." reasonLabel="Motif" onConfirm={(reason) => (cancel ? run(cancelPrescription, { id: cancel.id, reason }).ok : false)} />
    </>
  );
}
