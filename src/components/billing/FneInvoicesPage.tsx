"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SearchInput from "@/components/common/SearchInput";
import { FneInput } from "@/components/dashboard/DailyFigures";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PrinterIcon } from "@/icons";
import { clientName, docTotal, isActiveInvoice } from "@/lib/calc";
import { addDays, formatDate, formatXOF, normalize } from "@/lib/format";
import { cn } from "@/utils";
import { useState } from "react";

const sel = "h-11 rounded-full border border-gray-200 bg-white px-4 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

/** Factures et numéros FNE : filtres (période, avec / sans FNE, canal) et impression de la liste. */
export default function FneInvoicesPage() {
  const { db, today } = useDemo();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [fne, setFne] = useState<"" | "avec" | "sans">("");
  const [channel, setChannel] = useState<"" | "comptoir" | "autres">("");
  const [q, setQ] = useState("");
  const [print, setPrint] = useState(false);
  const t = normalize(q);
  const list = db.invoices
    .filter((i) => i.kind === "facture" && isActiveInvoice(i) && i.date.slice(0, 10) >= from && i.date.slice(0, 10) <= to)
    .filter((i) => (fne === "avec" ? !!i.fneNumber : fne === "sans" ? !i.fneNumber : true))
    .filter((i) => (channel === "comptoir" ? i.channel === "comptoir" : channel === "autres" ? i.channel !== "comptoir" : true))
    .filter((i) => !t || normalize(`${i.code} ${i.fneNumber ?? ""} ${clientName(db, i.clientId)}`).includes(t))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, i) => s + docTotal(i.lines), 0);
  const withFne = list.filter((i) => i.fneNumber);
  const filters = [`du ${formatDate(from)} au ${formatDate(to)}`, fne === "avec" ? "avec numéro FNE" : fne === "sans" ? "sans numéro FNE" : "toutes", channel === "comptoir" ? "ventes comptoir" : channel === "autres" ? "hors comptoir" : ""].filter(Boolean).join(" · ");
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Factures FNE" subtitle="Retrouvez, complétez et imprimez vos factures normalisées (FNE)" trail={[{ label: "Facturation", href: "/facturation" }]} actions={<Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer la liste</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="cliva-glow cliva-grad-gestion rounded-3xl p-4 text-white shadow-cliva"><p className="text-theme-xs text-white/80">Factures</p><p className="text-2xl font-semibold tabular-nums">{list.length}</p><p className="text-[11px] text-white/80">{formatXOF(total)}</p></div>
        <div className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3"><p className="text-theme-xs text-gray-500">Avec numéro FNE</p><p className="text-2xl font-semibold text-success-600 tabular-nums">{withFne.length}</p><p className="text-[11px] text-gray-500">{formatXOF(withFne.reduce((s, i) => s + docTotal(i.lines), 0))}</p></div>
        <div className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3"><p className="text-theme-xs text-gray-500">Sans numéro FNE</p><p className={cn("text-2xl font-semibold tabular-nums", list.length - withFne.length ? "text-warning-600" : "text-gray-900 dark:text-white")}>{list.length - withFne.length}</p><p className="text-[11px] text-gray-500">à compléter</p></div>
        <div className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3"><p className="text-theme-xs text-gray-500">Taux de conformité</p><p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{list.length ? Math.round((withFne.length / list.length) * 100) : 100} %</p></div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput value={q} onChange={setQ} placeholder="N° facture, N° FNE, client…" />
        <input type="date" aria-label="Du" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} />
        <input type="date" aria-label="Au" value={to} onChange={(e) => setTo(e.target.value)} className={sel} />
        <select aria-label="FNE" value={fne} onChange={(e) => setFne(e.target.value as typeof fne)} className={sel}><option value="">Avec et sans FNE</option><option value="avec">Avec numéro FNE</option><option value="sans">Sans numéro FNE</option></select>
        <select aria-label="Canal" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={sel}><option value="">Tous les canaux</option><option value="comptoir">Ventes au comptoir</option><option value="autres">Consultations, missions…</option></select>
      </div>
      <section className="custom-scrollbar overflow-x-auto rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">{["Date", "Facture", "Client", "Canal", "Montant", "N° FNE"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium", i === 4 ? "text-end" : "text-start")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">{formatDate(i.date)}</td>
                <td className="px-3 py-2"><Link href={`/facturation/factures/${i.id}`} className="font-medium text-gray-900 hover:underline dark:text-white">{i.code}</Link></td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{clientName(db, i.clientId)}</td>
                <td className="px-3 py-2 text-theme-xs text-gray-500">{i.channel === "comptoir" ? "Comptoir" : "Facture"}</td>
                <td className="px-3 py-2 text-end font-medium tabular-nums">{formatXOF(docTotal(i.lines))}</td>
                <td className="px-3 py-2"><FneInput key={`${i.id}-${i.fneNumber ?? ""}`} id={i.id} value={i.fneNumber} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="px-4 py-8 text-center text-sm text-gray-500">Aucune facture pour ces filtres.</p>}
      </section>
      <PrintFrame open={print} onClose={() => setPrint(false)} title="Liste des factures FNE">
        <PrintHeader title="Liste des factures" sub={filters} />
        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead><tr className="border-b-2 border-gray-800">{["Date", "Facture", "Client", "Canal", "Montant (FCFA)", "N° FNE"].map((h) => <th key={h} className="px-1.5 py-1 text-start">{h}</th>)}</tr></thead>
          <tbody>{list.map((i) => <tr key={i.id} className="border-b border-gray-200"><td className="px-1.5 py-1">{formatDate(i.date)}</td><td className="px-1.5 py-1">{i.code}</td><td className="px-1.5 py-1">{clientName(db, i.clientId)}</td><td className="px-1.5 py-1">{i.channel === "comptoir" ? "Comptoir" : "Facture"}</td><td className="px-1.5 py-1 text-end">{docTotal(i.lines).toLocaleString("fr-FR")}</td><td className="px-1.5 py-1">{i.fneNumber ?? "— à saisir"}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-gray-800 font-semibold"><td colSpan={4} className="px-1.5 py-1">{list.length} facture(s) · {withFne.length} avec FNE</td><td className="px-1.5 py-1 text-end">{total.toLocaleString("fr-FR")}</td><td /></tr></tfoot>
        </table>
      </PrintFrame>
    </div>
  );
}
