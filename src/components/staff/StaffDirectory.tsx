"use client";

import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PrinterIcon } from "@/icons";
import { establishmentName } from "@/lib/calc";
import { roleLabel } from "@/lib/permissions";
import { evalAverage, lastEvaluation } from "@/lib/staff";
import { useState } from "react";

/** Annuaire du personnel avec coordonnées, imprimable / exportable en PDF. */
export default function StaffDirectory() {
  const { db, user } = useDemo();
  const [print, setPrint] = useState(false);
  const staff = db.users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name));
  const isDG = user?.roleId === "dg";
  const rows = (paper: boolean) =>
    staff.map((u) => {
      const ev = lastEvaluation(db, u.id);
      return (
        <tr key={u.id} className="break-inside-avoid border-b border-gray-100 dark:border-gray-800">
          <td className="py-2 pe-3"><span className="block font-medium text-gray-900 dark:text-white">{u.name}</span><span className="block text-[11px] text-gray-500">{u.title}</span></td>
          <td className="py-2 pe-3 text-gray-700 dark:text-gray-300">{roleLabel(u.roleId)}</td>
          <td className="py-2 pe-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{paper ? u.phone : <a href={`tel:${u.phone.replace(/\s/g, "")}`} className="hover:underline">{u.phone}</a>}</td>
          <td className="py-2 pe-3 text-gray-700 dark:text-gray-300">{paper ? u.email : <a href={`mailto:${u.email}`} className="hover:underline">{u.email}</a>}</td>
          <td className="py-2 pe-3 text-gray-700 dark:text-gray-300">{establishmentName(db, u.establishmentId)}</td>
          {isDG && <td className="py-2 text-end tabular-nums text-gray-700 dark:text-gray-300">{ev ? `${evalAverage(ev).toFixed(1)}/5` : "—"}</td>}
        </tr>
      );
    });
  const head = (
    <tr className="border-b border-gray-300 text-start text-theme-xs text-gray-500">
      <th className="py-2 pe-3 text-start">Nom et fonction</th>
      <th className="py-2 pe-3 text-start">Rôle</th>
      <th className="py-2 pe-3 text-start">Téléphone</th>
      <th className="py-2 pe-3 text-start">E-mail</th>
      <th className="py-2 pe-3 text-start">Établissement</th>
      {isDG && <th className="py-2 text-end">Note</th>}
    </tr>
  );
  return (
    <div className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">{staff.length} membre(s) actif(s)</p>
        <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer / PDF</Button>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>{head}</thead>
          <tbody>{rows(false)}</tbody>
        </table>
      </div>
      <PrintFrame open={print} onClose={() => setPrint(false)} title="Annuaire du personnel">
        <PrintHeader title="Annuaire du personnel" sub={`${staff.length} membre(s)`} />
        <table className="mt-4 w-full text-[12px]">
          <thead>{head}</thead>
          <tbody>{rows(true)}</tbody>
        </table>
      </PrintFrame>
    </div>
  );
}
