"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import ComponentCard from "@/components/common/ComponentCard";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { docTotal } from "@/lib/calc";
import { ACTIVITY_META, activitiesOf } from "@/lib/clientActivity";
import { RENTE_SPECIES } from "@/lib/followup";
import { formatDate, formatXOF } from "@/lib/format";
import type { Client } from "@/lib/types";
import { cn } from "@/utils";

function Block({ tone, title, children, action }: { tone: keyof typeof ACTIVITY_META; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <p className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", ACTIVITY_META[tone].dot)} />
          {title}
        </span>
        {action}
      </p>
      <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  );
}

/** Vue d'ensemble d'un client unique : maison, ferme, comptoir, recommandation. */
export default function ClientProfileCard({ client }: { client: Client }) {
  const { db, can } = useDemo();
  const acts = activitiesOf(db, client);
  const pets = db.patients.filter((p) => p.ownerId === client.id && p.vitalStatus === "vivant" && !RENTE_SPECIES.includes(p.species));
  const farmAnimals = db.patients.filter((p) => p.ownerId === client.id && p.vitalStatus === "vivant" && RENTE_SPECIES.includes(p.species));
  const farms = db.farms.filter((f) => f.clientId === client.id);
  const sales = db.invoices.filter((i) => i.clientId === client.id && i.channel === "comptoir" && i.status !== "annulee");
  const salesTotal = sales.reduce((s, i) => s + docTotal(i.lines), 0);
  const referred = db.clients.filter((c) => c.referredByClientId === client.id || (c.referredBy && c.referredBy.toLowerCase() === client.name.toLowerCase()));
  const herdOf = (f: (typeof farms)[number]) =>
    f.lots
      .filter((l) => l.status === "actif")
      .map((l) => ({ species: l.species, count: [...f.headcounts].filter((h) => h.lotId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.count }))
      .filter((h) => h.count);

  return (
    <ComponentCard
      title="Profil du client"
      className="lg:col-span-2"
      actions={
        <span className="flex flex-wrap gap-1">
          {acts.length ? acts.map((a) => <span key={a} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ACTIVITY_META[a].cls)}>{ACTIVITY_META[a].label}</span>) : <span className="text-theme-xs text-gray-500">Aucune activité enregistrée</span>}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Block tone="compagnie" title={`Maison · ${pets.length} animal(aux)`} action={can("patients", "create") && <Link href={`/patients?nouveau=1&client=${client.id}`} className="text-theme-xs font-medium text-brand-600">+ Animal</Link>}>
          {pets.length ? pets.slice(0, 5).map((p) => <Link key={p.id} href={`/patients/${p.id}`} className="block truncate hover:underline"><SpeciesIcon species={p.species} /> {p.name} · {p.species}{p.breed ? ` ${p.breed}` : ""}</Link>) : <p className="text-theme-xs text-gray-500">Aucun animal de compagnie.</p>}
        </Block>
        <Block tone="rente" title={`Élevage · ${farms.length} exploitation(s)`} action={can("exploitations", "create") && <Link href={`/exploitations?nouveau=1&client=${client.id}`} className="text-theme-xs font-medium text-brand-600">+ Exploitation</Link>}>
          {farms.length ? (
            farms.map((f) => (
              <div key={f.id}>
                <Link href={`/exploitations/${f.id}`} className="block truncate font-medium hover:underline">{f.name}</Link>
                <p className="text-theme-xs text-gray-500">{[f.location, herdOf(f).map((h) => `${h.species} ${h.count}`).join(" · ")].filter(Boolean).join(" · ") || "Cheptel non renseigné"}</p>
              </div>
            ))
          ) : (
            <p className="text-theme-xs text-gray-500">Aucune exploitation.</p>
          )}
          {farmAnimals.length > 0 && <p className="text-theme-xs text-gray-500">{farmAnimals.length} animal(aux) de rente suivi(s) individuellement.</p>}
        </Block>
        <Block tone="pharmacie" title={`Comptoir · ${sales.length} achat(s)`} action={can("stock", "update") && <Link href="/stock/vente" className="text-theme-xs font-medium text-brand-600">Vendre</Link>}>
          {sales.length ? (
            <>
              <p>Total : <strong className="tabular-nums">{formatXOF(salesTotal)}</strong></p>
              <p className="text-theme-xs text-gray-500">Dernier achat le {formatDate(sales[0].date)}{sales[0].saleInfo?.purpose ? ` · ${sales[0].saleInfo.purpose}` : ""}</p>
            </>
          ) : (
            <p className="text-theme-xs text-gray-500">Aucun achat au comptoir.</p>
          )}
        </Block>
      </div>
      <p className="text-theme-xs text-gray-500">
        {client.acquisition ? `Connu via : ${client.acquisition}. ` : ""}
        {client.referredBy ? `Recommandé par ${client.referredBy}. ` : ""}
        {referred.length ? `A recommandé ${referred.length} client(s) : ${referred.map((r) => r.name).join(", ")}.` : ""}
      </p>
    </ComponentCard>
  );
}
