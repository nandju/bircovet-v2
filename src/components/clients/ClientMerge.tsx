"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { SelectField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { Link } from "@/i18n/navigation";
import { MergeIcon } from "@/icons";
import { formatDate } from "@/lib/format";
import { duplicateGroups, mergeClients, mergePreview } from "@/lib/services/clientsService";
import { cn } from "@/utils";
import { useState } from "react";

const LABELS: Record<string, string> = { patients: "Patients", appointments: "Rendez-vous", consultations: "Consultations", invoices: "Factures", payments: "Paiements", farms: "Exploitations", documents: "Documents" };

export default function ClientMerge() {
  const { db, run, can } = useDemo();
  const opts = useOptions();
  const groups = duplicateGroups(db);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const confirm = useModal();
  const a = db.clients.find((c) => c.id === primary);
  const b = db.clients.find((c) => c.id === secondary);
  const preview = b ? mergePreview(db, b.id) : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Recherche de doublons et fusion supervisée" trail={[{ label: "Clients", href: "/clients" }]} />
      <DemoNotice>La fusion est une action distincte et confirmée : la fiche secondaire est archivée (jamais supprimée) et ses patients, rendez-vous, factures, paiements et documents sont rattachés à la fiche principale. Elle est tracée au journal.</DemoNotice>

      <ComponentCard title="Doublons potentiels détectés" desc="Même numéro de téléphone ou nom identique (ordre des mots ignoré)">
        {groups.length === 0 ? (
          <EmptyState title="Aucun doublon potentiel" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.map((c) => c.id).join()} className="rounded-xl border border-warning-200 bg-warning-25 p-3 dark:border-warning-800 dark:bg-warning-500/5">
                {g.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-800 hover:underline dark:text-white/90">
                      {c.name} <span className="text-theme-xs text-gray-500">({c.code} · créé le {formatDate(c.createdAt)})</span>
                    </Link>
                    <span className="text-theme-xs text-gray-500">{c.phone}</span>
                  </div>
                ))}
                <Button
                  size="xs"
                  variant="soft"
                  className="mt-2"
                  onClick={() => {
                    setPrimary(g[0].id);
                    setSecondary(g[1].id);
                  }}
                >
                  Préparer la fusion
                </Button>
              </div>
            ))}
          </div>
        )}
      </ComponentCard>

      <ComponentCard title="Fusion supervisée">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="Fiche principale (conservée)" value={primary} onChange={setPrimary} options={opts.clients} />
          <SelectField label="Fiche secondaire (archivée)" value={secondary} onChange={setSecondary} options={opts.clients.filter((o) => o.value !== primary)} />
        </div>
        {a && b && preview && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[a, b].map((c, i) => (
              <div key={c.id} className={cn("rounded-xl border p-4", i === 0 ? "border-brand-200 bg-brand-25 dark:border-brand-800 dark:bg-brand-500/5" : "border-gray-200 dark:border-gray-800")}>
                <p className="text-theme-xs font-medium text-gray-500 uppercase">{i === 0 ? "Conservée" : "Sera archivée"}</p>
                <p className="mt-1 font-medium text-gray-800 dark:text-white/90">{c.name}</p>
                <p className="text-sm text-gray-500">
                  {c.code} · {c.phoneCode} {c.phone} · {c.email || "sans e-mail"}
                </p>
                {i === 1 && (
                  <ul className="mt-3 grid grid-cols-2 gap-1 text-sm">
                    {Object.entries(preview).map(([k, v]) => (
                      <li key={k}>
                        {LABELS[k]} : <strong>{v}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button startIcon={<MergeIcon />} disabled={!a || !b || !can("clients", "update")} onClick={confirm.openModal}>
            Fusionner…
          </Button>
        </div>
      </ComponentCard>

      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={confirm.closeModal}
        title="Confirmer la fusion"
        tone="danger"
        message={
          <>
            <strong>{b?.name}</strong> sera archivé et tous ses éléments seront rattachés à <strong>{a?.name}</strong>. Cette opération est tracée au journal.
          </>
        }
        reasonLabel="Motif de la fusion"
        confirmLabel="Fusionner"
        onConfirm={(reason) => {
          const r = run(mergeClients, { primaryId: primary, secondaryId: secondary, reason });
          if (r.ok) setSecondary("");
          return r.ok;
        }}
      />
    </div>
  );
}
