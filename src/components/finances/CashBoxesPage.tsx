"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { usePeriod } from "@/components/margins/MarginsParts";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { clientName, isActiveInvoice, lineTotal, userName } from "@/lib/calc";
import { formatDate, formatXOF, normalize } from "@/lib/format";
import { FAMILY_COLORS, revenueByFamily, sourceOf, DEFAULT_FAMILIES } from "@/lib/revenue";
import { addCashBoxEntry, assignToCashBox, boxOf, boxTotal, removeCashBoxEntry, saveCashBox } from "@/lib/services/cashBoxService";
import type { CashBox } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const COLORS = Object.keys(FAMILY_COLORS);
const inp = "h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

function Assign({ box, onClose }: { box: CashBox; onClose: () => void }) {
  const { db, run, today } = useDemo();
  const [tab, setTab] = useState<"prestation" | "encaissement" | "entree">("prestation");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [fam, setFam] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [entry, setEntry] = useState({ label: "", amount: NaN, date: today });
  const families = db.settings.revenueFamilies?.length ? db.settings.revenueFamilies : DEFAULT_FAMILIES;
  const famKeys = new Set(families.find((f) => f.id === fam)?.keys ?? []);
  const t = normalize(q);
  const inP = (d: string) => d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const lines = db.invoices
    .filter((i) => i.kind === "facture" && isActiveInvoice(i) && inP(i.date))
    .flatMap((i) => i.lines.map((l) => ({ i, l, key: `${i.id}|${l.id}` })))
    .filter(({ i, l }) => !boxOf(db, { lineId: l.id }) && (!fam || famKeys.has(sourceOf(db, i, l))) && (!t || normalize(`${l.label} ${i.code} ${clientName(db, i.clientId)}`).includes(t)));
  const pays = db.payments.filter((p) => inP(p.date) && !boxOf(db, { paymentId: p.id }) && (!t || normalize(`${p.code} ${clientName(db, p.clientId)} ${p.note}`).includes(t)));
  const items = tab === "prestation" ? lines.map((x) => ({ key: x.key, label: x.l.label, sub: `${x.i.code} · ${clientName(db, x.i.clientId)} · ${formatDate(x.i.date)}`, amount: lineTotal(x.l) })) : pays.map((p) => ({ key: p.id, label: `${p.code} · ${clientName(db, p.clientId)}`, sub: `${formatDate(p.date)} · ${p.method}`, amount: p.amount }));
  const sum = items.filter((x) => picked.has(x.key)).reduce((s, x) => s + x.amount, 0);
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const save = () => {
    if (tab === "entree") return run(addCashBoxEntry, { boxId: box.id, label: entry.label, amount: entry.amount, date: entry.date }).ok && onClose();
    const r = tab === "prestation" ? run(assignToCashBox, { boxId: box.id, lines: [...picked].map((k) => ({ invoiceId: k.split("|")[0], lineId: k.split("|")[1] })) }) : run(assignToCashBox, { boxId: box.id, paymentIds: [...picked] });
    if (r.ok) onClose();
  };
  return (
    <AppModal isOpen onClose={onClose} size="xl" title={`Affecter à « ${box.name} »`} footer={<><span className="me-auto text-sm text-gray-600 dark:text-gray-400">{tab !== "entree" && <>{picked.size} sélection(s) · <strong className="tabular-nums">{formatXOF(sum)}</strong></>}</span><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={save} disabled={tab === "entree" ? !entry.label.trim() || !(entry.amount > 0) : !picked.size}>Affecter</Button></>}>
      <div className="space-y-3">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
          {([["prestation", "Prestations et ventes"], ["encaissement", "Encaissements"], ["entree", "Autre entrée"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPicked(new Set()); }} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>{l}</button>)}
        </div>
        {tab === "entree" ? (
          <FormGrid>
            <TextField label="Libellé" value={entry.label} onChange={(x) => setEntry({ ...entry, label: x })} placeholder="Ex. : apport de la mairie, don, subvention…" className="sm:col-span-2" />
            <NumberField label="Montant" suffix="FCFA" value={entry.amount} onChange={(x) => setEntry({ ...entry, amount: x })} min={0} step={1000} />
            <TextField label="Date" type="date" value={entry.date} onChange={(x) => setEntry({ ...entry, date: x })} />
            <p className="text-theme-xs text-gray-500 sm:col-span-2">Pour le suivi seulement : cette entrée ne modifie pas les soldes des comptes. Pour de l&apos;argent réellement reçu, passez par un encaissement.</p>
          </FormGrid>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <input className={cn(inp, "min-w-48 flex-1")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : client, acte, n° de facture…" aria-label="Rechercher" />
              <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
              <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
              {tab === "prestation" && <select className={inp} value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Famille de recettes"><option value="">Toutes les familles</option>{families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}
              <Button size="sm" variant="ghost" onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((x) => x.key)))}>{picked.size === items.length && items.length ? "Tout décocher" : "Tout cocher"}</Button>
            </div>
            <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {items.map((x) => (
                <li key={x.key}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5">
                    <input type="checkbox" checked={picked.has(x.key)} onChange={() => toggle(x.key)} className="size-4 accent-brand-500" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-gray-800 dark:text-white/90">{x.label}</span><span className="block truncate text-theme-xs text-gray-500">{x.sub}</span></span>
                    <span className="text-sm font-medium tabular-nums">{formatXOF(x.amount)}</span>
                  </label>
                </li>
              ))}
              {!items.length && <li className="px-3 py-8 text-center text-sm text-gray-500">Rien à affecter sur la période (déjà affecté ou aucun résultat).</li>}
            </ul>
          </>
        )}
      </div>
    </AppModal>
  );
}

function Detail({ box, onClose, label, from, to }: { box: CashBox; onClose: () => void; label: string; from: string; to: string }) {
  const { db, run } = useDemo();
  const list = box.entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <AppModal isOpen onClose={onClose} size="lg" title={box.name} description={`${label} · ${formatXOF(boxTotal(box, from, to))}`}>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-20 shrink-0 text-theme-xs text-gray-500">{formatDate(e.date)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-gray-800 dark:text-white/90">{e.label}</span><span className="text-theme-xs text-gray-500">{e.kind === "prestation" ? "Prestation / vente" : e.kind === "encaissement" ? "Encaissement" : "Autre entrée"} · {userName(db, e.byId)}</span></span>
            <span className="font-medium tabular-nums">{formatXOF(e.amount)}</span>
            <Button size="xs" variant="ghost" className="text-error-600" onClick={() => run(removeCashBoxEntry, { boxId: box.id, entryId: e.id }, { silent: true })} aria-label="Retirer">Retirer</Button>
          </li>
        ))}
        {!list.length && <li className="py-6 text-center text-sm text-gray-500">Rien sur la période.</li>}
      </ul>
    </AppModal>
  );
}

export default function CashBoxesPage() {
  const { db, run, user } = useDemo();
  const { period, label, picker } = usePeriod("mois");
  const [edit, setEdit] = useState<{ id?: string; name: string; description?: string; color: string; target?: number; accountId?: string; active: boolean } | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const boxes = db.cashBoxes ?? [];
  const isDG = user?.roleId === "dg";
  const total = boxes.reduce((s, b) => s + boxTotal(b, period.from, period.to), 0);
  const all = revenueByFamily(db, period).total;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Caisses de suivi"
        subtitle="Regroupez des prestations, des encaissements ou des entrées pour suivre une activité (campagne, ferme, partenaire…)"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={isDG && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({ name: "", description: "", color: COLORS[boxes.length % COLORS.length], active: true })}>Nouvelle caisse</Button>}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {picker}
        <p className="text-sm text-gray-600 dark:text-gray-400">{label} : <strong className="tabular-nums">{formatXOF(total)}</strong> suivis dans les caisses{all ? ` · ${Math.round((total / all) * 100)} % des recettes facturées` : ""}</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {boxes.map((b) => {
          const v = boxTotal(b, period.from, period.to);
          const ever = boxTotal(b);
          const n = b.entries.filter((e) => e.date >= period.from && e.date <= period.to).length;
          return (
            <li key={b.id} className={cn("cliva-rise flex flex-col gap-2 rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3", !b.active && "opacity-60")}>
              <div className="flex items-center gap-2">
                <span className={cn("size-3 rounded-full", FAMILY_COLORS[b.color]?.dot ?? "bg-gray-400")} />
                <p className="min-w-0 flex-1 truncate font-semibold text-gray-800 dark:text-white/90">{b.name}</p>
                <span className="text-theme-xs text-gray-500">{b.code}</span>
              </div>
              {b.description && <p className="text-theme-sm text-gray-500">{b.description}</p>}
              <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(v)}</p>
              <p className="text-theme-xs text-gray-500">{n} élément(s) sur la période · {formatXOF(ever)} depuis la création{b.accountId ? ` · compte : ${db.accounts.find((a) => a.id === b.accountId)?.name ?? ""}` : ""}</p>
              {b.target ? (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className={cn("h-full rounded-full", FAMILY_COLORS[b.color]?.bar ?? "bg-brand-500")} style={{ width: `${Math.min(100, (ever / b.target) * 100)}%` }} /></div>
                  <p className="mt-0.5 text-theme-xs text-gray-500">Objectif {formatXOF(b.target)} · {Math.round((ever / b.target) * 100)} %</p>
                </div>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {b.active && <Button size="xs" onClick={() => setAssign(b.id)}>Affecter</Button>}
                <Button size="xs" variant="soft" onClick={() => setDetail(b.id)}>Voir le détail</Button>
                {isDG && <Button size="xs" variant="ghost" onClick={() => setEdit({ ...b })}>Modifier</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      {!boxes.length && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune caisse de suivi.</p>}
      {edit && (
        <AppModal isOpen onClose={() => setEdit(null)} title={edit.id ? "Modifier la caisse" : "Nouvelle caisse de suivi"} footer={<><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Annuler</Button><Button size="sm" onClick={() => run(saveCashBox, edit).ok && setEdit(null)} disabled={!edit.name.trim()}>Enregistrer</Button></>}>
          <FormGrid>
            <TextField label="Nom" required value={edit.name} onChange={(x) => setEdit({ ...edit, name: x })} placeholder="Ex. : Campagne rage, Ferme Koné, Chirurgie" className="sm:col-span-2" />
            <TextAreaField label="À quoi sert-elle ?" value={edit.description ?? ""} onChange={(x) => setEdit({ ...edit, description: x })} rows={2} className="sm:col-span-2" />
            <NumberField label="Objectif (facultatif)" suffix="FCFA" value={edit.target ?? NaN} onChange={(x) => setEdit({ ...edit, target: Number.isNaN(x) ? undefined : x })} min={0} step={10000} />
            <SelectField label="Compte où va l'argent (facultatif)" value={edit.accountId ?? ""} onChange={(x) => setEdit({ ...edit, accountId: x })} options={db.accounts.map((a) => ({ value: a.id, label: a.name }))} allowEmpty placeholder="—" />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Couleur</p>
              <div className="flex gap-1.5">{COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={edit.color === c} onClick={() => setEdit({ ...edit, color: c })} className={cn("size-7 rounded-full", FAMILY_COLORS[c].dot, edit.color === c ? "ring-2 ring-gray-900 ring-offset-2 dark:ring-white" : "opacity-60")} />)}</div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="size-4 accent-brand-500" />Caisse ouverte</label>
          </FormGrid>
        </AppModal>
      )}
      {assign && boxes.find((b) => b.id === assign) && <Assign box={boxes.find((b) => b.id === assign)!} onClose={() => setAssign(null)} />}
      {detail && boxes.find((b) => b.id === detail) && <Detail box={boxes.find((b) => b.id === detail)!} onClose={() => setDetail(null)} label={label} from={period.from} to={period.to} />}
    </div>
  );
}
