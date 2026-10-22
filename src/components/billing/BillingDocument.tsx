"use client";

import ClivaLogo from "@/components/common/ClivaLogo";
import { useDemo } from "@/context/DemoStoreContext";
import { docGross, docTotal, lineTotal } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import type { InvoiceLine } from "@/lib/types";

interface Props {
  title: string;
  code: string;
  date: string;
  secondDate?: { label: string; value: string };
  clientName: string;
  payerName: string;
  lines: InvoiceLine[];
  footerRows?: { label: string; value: string; strong?: boolean }[];
  notes?: string;
  meta?: { label: string; value: string }[];
}

/** Document imprimable (facture, devis, avoir) portant la mention « DÉMONSTRATION — SANS VALEUR FISCALE ». */
export default function BillingDocument({ title, code, date, secondDate, clientName, payerName, lines, footerRows = [], notes, meta = [] }: Props) {
  const { db, establishment } = useDemo();
  const total = docTotal(lines);
  const discount = docGross(lines) - total;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 print:border-0 print:p-0 dark:border-gray-800 dark:bg-gray-900 print:dark:bg-white">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <span className="-rotate-[24deg] text-center text-3xl font-bold tracking-widest text-error-500/10 sm:text-5xl">DÉMONSTRATION<br />SANS VALEUR FISCALE</span>
      </div>
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div>
            <ClivaLogo />
            <p className="mt-2 text-theme-xs text-gray-500">{db.settings.legalName}</p>
            <p className="text-theme-xs text-gray-500">{establishment?.address}</p>
            <p className="text-theme-xs text-gray-500">{db.settings.phone} · {db.settings.email}</p>
          </div>
          <div className="sm:text-end">
            <p className="text-xl font-semibold text-gray-800 uppercase dark:text-white/90 print:text-gray-900">{title}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">N° interne de démonstration : <strong>{code}</strong></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Date : {formatDate(date)}</p>
            {secondDate && <p className="text-sm text-gray-600 dark:text-gray-400">{secondDate.label} : {formatDate(secondDate.value)}</p>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 dark:bg-white/3 print:bg-gray-50">
          <div>
            <p className="text-theme-xs text-gray-500 uppercase">Client</p>
            <p className="font-medium text-gray-800 dark:text-white/90 print:text-gray-900">{clientName}</p>
          </div>
          <div>
            <p className="text-theme-xs text-gray-500 uppercase">Payeur</p>
            <p className="font-medium text-gray-800 dark:text-white/90 print:text-gray-900">{payerName}</p>
          </div>
          {meta.map((m) => (
            <div key={m.label}>
              <p className="text-theme-xs text-gray-500 uppercase">{m.label}</p>
              <p className="text-gray-800 dark:text-white/90 print:text-gray-900">{m.value}</p>
            </div>
          ))}
        </div>
        <div className="custom-scrollbar mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">
                <th className="py-2 text-start">Désignation</th>
                <th className="py-2 text-end">Qté</th>
                <th className="py-2 text-end">P.U.</th>
                <th className="py-2 text-end">Remise</th>
                <th className="py-2 text-end">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pe-3 text-gray-800 dark:text-white/90 print:text-gray-900">
                    {l.label}
                    {l.source && <span className="block text-[11px] text-gray-500">Origine : {l.source.label}</span>}
                  </td>
                  <td className="py-2 text-end">{l.qty}</td>
                  <td className="py-2 text-end">{formatXOF(l.unitPrice)}</td>
                  <td className="py-2 text-end">{l.discountPct ? `${l.discountPct} %` : "—"}</td>
                  <td className="py-2 text-end font-medium">{formatXOF(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ms-auto w-full max-w-xs space-y-1 text-sm">
          {discount > 0 && (
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Remises</span>
              <span>− {formatXOF(discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90 print:text-gray-900">
            <span>Total (XOF)</span>
            <span>{formatXOF(total)}</span>
          </div>
          {footerRows.map((r) => (
            <div key={r.label} className={`flex justify-between ${r.strong ? "font-semibold text-gray-800 dark:text-white/90" : "text-gray-600 dark:text-gray-400"}`}>
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
        </div>
        {notes && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{notes}</p>}
        <p className="mt-6 border-t border-dashed border-gray-200 pt-3 text-center text-theme-xs font-semibold tracking-wide text-error-600 dark:border-gray-800">{db.settings.documentFooter}</p>
        <p className="text-center text-[11px] text-gray-400">Aucun numéro officiel, certificat, QR code fiscal ni confirmation FNE/RNE n&apos;est produit dans cette démonstration.</p>
      </div>
    </div>
  );
}
