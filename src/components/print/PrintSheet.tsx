"use client";

import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PrinterIcon } from "@/icons";
import { formatDateTime, isoLocal } from "@/lib/format";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Watermark from "./Watermark";

export interface PrintColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: "end";
}

interface Props<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Filtres actifs, repris en tête du document. */
  filters?: string[];
  columns: PrintColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  summary?: ReactNode;
  emptyText?: string;
  /** Contrôles affichés au-dessus de l'aperçu (filtres), jamais imprimés. */
  toolbar?: ReactNode;
}

/** Cadre d'impression A4 réutilisable : superpose l'aperçu et n'imprime que lui. */
export function PrintFrame({ open, onClose, title, toolbar, children }: { open: boolean; onClose: () => void; title: string; toolbar?: ReactNode; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("cliva-printing");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("cliva-printing");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div id="print-sheet" role="dialog" aria-modal="true" aria-label={title} className="cliva-fade fixed inset-0 z-[100000] overflow-y-auto bg-gray-900/60 p-3 sm:p-6 print:static print:overflow-visible print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-white">Aperçu avant impression · choisissez « Enregistrer au format PDF » dans la fenêtre d&apos;impression.</p>
        <div className="flex gap-2">
          <Button size="sm" startIcon={<PrinterIcon />} onClick={() => window.print()}>Imprimer / PDF</Button>
          <Button size="sm" variant="outline" onClick={onClose} className="bg-white">Fermer</Button>
        </div>
      </div>
      {toolbar && <div className="mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-xl bg-white p-2 print:hidden dark:bg-gray-900">{toolbar}</div>}
      <article className="relative mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] text-gray-900 shadow-xl print:max-w-none print:p-0 print:shadow-none">{children}</article>
      <Watermark inFrame />
    </div>,
    document.body,
  );
}

/** En-tête commun des documents imprimés. */
export function PrintHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  const { db, user, establishment } = useDemo();
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-gray-900 pb-3">
      <div>
        <p className="text-base font-bold tracking-wide">{(db.settings.branding?.platformName || "Cliva").toUpperCase()}</p>
        <p>{db.settings.legalName}</p>
        <p>{establishment?.name} · {establishment?.address}</p>
        <p>{db.settings.phone} · {db.settings.email}</p>
      </div>
      <div className="text-end">
        <h1 className="text-lg font-bold">{title}</h1>
        {sub}
        <p>Édité le {formatDateTime(isoLocal())} par {user?.name}</p>
      </div>
    </header>
  );
}

/**
 * Aperçu imprimable (A4) : en-tête de la clinique, filtres, tableau.
 * « Imprimer / PDF » ouvre la fenêtre d'impression du navigateur, qui propose « Enregistrer au format PDF ».
 */
export default function PrintSheet<T>({ open, onClose, title, filters = [], columns, rows, rowKey, summary, emptyText = "Aucune ligne.", toolbar }: Props<T>) {
  const { db } = useDemo();
  return (
    <PrintFrame open={open} onClose={onClose} title={title} toolbar={toolbar}>
      <PrintHeader title={title} />
      {filters.length > 0 && <p className="mt-3"><strong>Filtres :</strong> {filters.join(" · ")}</p>}
      {summary && <div className="mt-3">{summary}</div>}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`border-b border-gray-400 px-1.5 py-1 text-start font-semibold ${c.align === "end" ? "text-end" : ""}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="break-inside-avoid">
              {columns.map((c, i) => (
                <td key={i} className={`border-b border-gray-200 px-1.5 py-1 align-top ${c.align === "end" ? "text-end tabular-nums" : ""}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-1.5 py-4 text-center text-gray-500">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
      <footer className="mt-6 flex justify-between border-t border-gray-300 pt-2 text-[10px] text-gray-500">
        <span>{rows.length} ligne(s)</span>
        <span>{db.settings.documentFooter}</span>
      </footer>
    </PrintFrame>
  );
}
