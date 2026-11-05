"use client";

import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import { useDemo } from "@/context/DemoStoreContext";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import type { Prescription } from "@/lib/types";

const SEX: Record<string, string> = { male: "mâle", femelle: "femelle", male_castre: "mâle castré", femelle_sterilisee: "femelle stérilisée" };
const RENTE = ["Bovin", "Ovin", "Caprin", "Porcin", "Volaille", "Équidé", "Lapin", "Poisson"];

/** Ordonnance imprimable (A4 portrait) : tous les médicaments, consignes, signature. */
export function OrderSheet({ lines }: { lines: Prescription[] }) {
  const { db } = useDemo();
  const first = lines[0];
  if (!first) return null;
  const pt = db.patients.find((p) => p.id === first.patientId);
  const owner = db.clients.find((c) => c.id === (pt?.ownerId ?? first.clientId));
  const kg = pt ? [...pt.vitals].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg : undefined;
  const rente = !!pt && RENTE.includes(pt.species);
  const human = lines.some((l) => db.products.find((p) => p.id === l.productId)?.humanUse);
  return (
    <div className="text-[11.5px] leading-snug">
      <PrintHeader title={`Ordonnance ${first.orderCode ?? first.code}`} sub={<p>du {formatDate(first.date)}</p>} />
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
        <p><strong>Animal :</strong> {pt ? `${pt.name} · ${pt.species}${pt.breed ? ` ${pt.breed}` : ""}${SEX[pt.sex] ? ` · ${SEX[pt.sex]}` : ""}` : "—"}{kg ? ` · ${kg} kg` : ""}</p>
        <p><strong>Propriétaire :</strong> {owner ? `${owner.name}${owner.phone ? ` · ${owner.phone}` : ""}` : "—"}</p>
        <p><strong>Vétérinaire :</strong> {userName(db, first.vetId)}</p>
        <p><strong>Identification :</strong> {pt?.code ?? "—"}</p>
      </div>
      <ol className="mt-4 space-y-3">
        {lines.map((l, i) => {
          const p = db.products.find((x) => x.id === l.productId);
          const wd = rente && p && (p.withdrawalMeatDays != null || p.withdrawalMilkDays != null) ? `Délais d'attente : viande ${p.withdrawalMeatDays ?? "—"} j, lait ${p.withdrawalMilkDays ?? "—"} j` : "";
          return (
            <li key={l.id} className="break-inside-avoid border-b border-gray-300 pb-2">
              <p className="text-[12.5px] font-bold">{i + 1}. {p?.brandName ?? p?.name ?? "Médicament"}{l.form ? ` — ${l.form}` : ""}</p>
              <p><strong>{l.dose}</strong>{l.route ? ` · voie ${l.route}` : ""}{l.frequency ? ` · ${l.frequency}` : ""}{l.duration ? ` · pendant ${l.duration}` : ""}</p>
              <p>Quantité : {l.quantity} {p?.saleUnit?.toLowerCase() ?? ""}</p>
              {l.instructions && <p className="whitespace-pre-line text-gray-700">{l.instructions}</p>}
              {wd && <p className="font-semibold">{wd}</p>}
            </li>
          );
        })}
      </ol>
      {first.orderNote && <p className="mt-3 whitespace-pre-line"><strong>Consignes :</strong> {first.orderNote}</p>}
      {human && <p className="mt-2 text-[10.5px]">Spécialité à usage humain prescrite hors AMM vétérinaire, sous la responsabilité du vétérinaire prescripteur.</p>}
      <div className="mt-10 flex justify-end">
        <div className="w-64 border-t border-gray-500 pt-1 text-center text-[10.5px]">Signature et cachet du vétérinaire</div>
      </div>
    </div>
  );
}

export function OrderPrint({ lines, onClose }: { lines: Prescription[] | null; onClose: () => void }) {
  return (
    <PrintFrame open={!!lines?.length} onClose={onClose} title="Ordonnance">
      {lines && <OrderSheet lines={lines} />}
    </PrintFrame>
  );
}
