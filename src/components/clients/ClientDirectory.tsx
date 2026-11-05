"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { clientOutstanding } from "@/lib/calc";
import { ACTIVITY_META, activitiesOf } from "@/lib/clientActivity";
import { farmHerd } from "@/lib/farmProfile";
import { formatDate, formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import type { Client } from "@/lib/types";
import { cn } from "@/utils";

function Card({ c, paper = false }: { c: Client; paper?: boolean }) {
  const { db } = useDemo();
  const pets = db.patients.filter((p) => p.ownerId === c.id && p.vitalStatus === "vivant" && !p.archived);
  const farms = db.farms.filter((f) => f.clientId === c.id);
  const due = clientOutstanding(db, c.id);
  const prefs = Object.entries(c.commPrefs).filter(([, v]) => v).map(([k]) => ({ sms: "SMS", whatsapp: "WhatsApp", email: "E-mail", call: "Appel" })[k] ?? k);
  return (
    <article className={cn("break-inside-avoid rounded-2xl border p-4", paper ? "border-gray-400" : "cliva-rise border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {paper ? <p className="font-semibold">{c.name}</p> : <Link href={`/clients/${c.id}`} className="block truncate font-semibold text-gray-900 hover:underline dark:text-white">{c.name}</Link>}
          <p className="text-[11px] text-gray-500">{c.code} · {labelOf("clientType", c.type)} · client depuis {formatDate(c.createdAt)}</p>
        </div>
        <span className="flex shrink-0 gap-1">
          {activitiesOf(db, c).map((a) => <span key={a} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", ACTIVITY_META[a].cls)}>{ACTIVITY_META[a].short}</span>)}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-theme-xs">
        <dt className="text-gray-500">Téléphone</dt><dd className="text-gray-800 dark:text-white/90">{c.phoneCode} {c.phone || "—"}</dd>
        {c.email && <><dt className="text-gray-500">E-mail</dt><dd className="truncate text-gray-800 dark:text-white/90">{c.email}</dd></>}
        <dt className="text-gray-500">Adresse</dt><dd className="text-gray-800 dark:text-white/90">{[c.address, c.city].filter(Boolean).join(", ") || "—"}</dd>
        {prefs.length > 0 && <><dt className="text-gray-500">Préférences</dt><dd className="text-gray-800 dark:text-white/90">{prefs.join(", ")}</dd></>}
        {c.contacts.length > 0 && <><dt className="text-gray-500">Contacts</dt><dd className="text-gray-800 dark:text-white/90">{c.contacts.map((x) => `${x.name} (${x.relation}) ${x.phone}`).join(" ; ")}</dd></>}
        {(c.referredBy || c.acquisition) && <><dt className="text-gray-500">Origine</dt><dd className="text-gray-800 dark:text-white/90">{[c.acquisition, c.referredBy && `recommandé par ${c.referredBy}`].filter(Boolean).join(" · ")}</dd></>}
        <dt className="text-gray-500">Animaux</dt>
        <dd className="text-gray-800 dark:text-white/90">{pets.length ? pets.map((p) => <span key={p.id} className="me-2 inline-flex items-center gap-1"><SpeciesIcon species={p.species} />{p.name}</span>) : "—"}</dd>
        {farms.length > 0 && <><dt className="text-gray-500">Élevage(s)</dt><dd className="text-gray-800 dark:text-white/90">{farms.map((f) => <span key={f.id} className="block">{f.name} ({f.location}) : {farmHerd(f).map((h) => <span key={h.species} className="me-1.5 inline-flex items-center gap-0.5"><SpeciesIcon species={h.species} />{h.count.toLocaleString("fr-FR")}</span>)}</span>)}</dd></>}
        <dt className="text-gray-500">Dernière visite</dt><dd className="text-gray-800 dark:text-white/90">{formatDate(c.lastActivityAt)}</dd>
        <dt className="text-gray-500">Solde dû</dt><dd className={due > 0 ? "font-semibold text-error-600" : "text-gray-800 dark:text-white/90"}>{formatXOF(due)}</dd>
      </dl>
    </article>
  );
}

/** Annuaire clients : toutes les informations en fiches, imprimable. */
export default function ClientDirectory({ rows, print, onClosePrint }: { rows: Client[]; print: boolean; onClosePrint: () => void }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 px-4 md:grid-cols-2 2xl:grid-cols-3">{rows.map((c) => <Card key={c.id} c={c} />)}</div>
      {!rows.length && <p className="px-4 py-8 text-center text-sm text-gray-500">Aucun client trouvé.</p>}
      <PrintFrame open={print} onClose={onClosePrint} title="Annuaire des clients">
        <PrintHeader title="Annuaire des clients" sub={`${rows.length} client(s)`} />
        <div className="mt-4 columns-2 gap-3 space-y-3 text-[11px]">{rows.map((c) => <Card key={c.id} c={c} paper />)}</div>
      </PrintFrame>
    </>
  );
}
