"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { clientName } from "@/lib/calc";
import { ageFrom, formatDate } from "@/lib/format";

/** Accueil du confrère référent : uniquement les dossiers explicitement partagés. */
export default function SharedRecords() {
  const { db, user } = useDemo();
  const ids = new Set(user?.sharedPatientIds ?? []);
  const patients = db.patients.filter((p) => ids.has(p.id));
  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Dossiers partagés" subtitle="Espace confrère référent" />
      <DemoNotice>Seuls les dossiers explicitement partagés avec vous sont visibles dans cette démonstration. Le partage réel et sa sécurité seront gérés côté serveur.</DemoNotice>
      {patients.length === 0 ? (
        <EmptyState title="Aucun dossier partagé" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {patients.map((p) => {
            const cons = db.consultations.filter((c) => c.patientId === p.id && c.status === "valide").slice(0, 3);
            const docs = db.documents.filter((d) => d.linked.kind === "patient" && d.linked.id === p.id && d.status === "actif");
            return (
              <ComponentCard key={p.id} title={`${p.name} — ${p.species}, ${p.breed}`} desc={`${p.code} · ${ageFrom(p.birthDate)} · propriétaire ${clientName(db, p.ownerId)}`} actions={<Link href={`/patients/${p.id}`} className="text-sm font-medium text-brand-600">Ouvrir le dossier</Link>}>
                <div>
                  <p className="mb-1 text-theme-xs font-medium text-gray-500 uppercase">Dernières consultations validées</p>
                  {cons.length ? cons.map((c) => <p key={c.id} className="text-sm text-gray-700 dark:text-gray-300">{formatDate(c.date)} — {c.reason}</p>) : <p className="text-sm text-gray-400">Aucune</p>}
                </div>
                <div>
                  <p className="mb-1 text-theme-xs font-medium text-gray-500 uppercase">Documents partagés</p>
                  {docs.length ? docs.map((d) => <p key={d.id} className="text-sm text-gray-700 dark:text-gray-300">{d.title}</p>) : <p className="text-sm text-gray-400">Aucun</p>}
                </div>
              </ComponentCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
