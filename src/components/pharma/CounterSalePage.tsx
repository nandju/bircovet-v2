"use client";

import SpeciesIcon, { speciesEmoji } from "@/components/common/SpeciesIcon";
import AnnouncementCarousel from "@/components/common/AnnouncementCarousel";
import { CounterSalesToday, StockOutCard } from "@/components/dashboard/DailyFigures";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { productStock } from "@/lib/calc";
import { ACTIVITY_META, activitiesOf, findClients, phoneKey } from "@/lib/clientActivity";
import { formatXOF, uid } from "@/lib/format";
import { shelfLabel } from "@/lib/pharma/shelves";
import { counterSale, HERD_SPECIES } from "@/lib/services/counterSaleService";
import type { Client, PaymentMethod } from "@/lib/types";
import { cn } from "@/utils";
import { PrescriptionModal } from "@/components/prescriptions/PrescriptionModals";
import { useMemo, useState } from "react";

const input = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-white/90";
const ACQ = ["Bouche-à-oreille", "Recommandé par un client", "Réseaux sociaux", "Passage devant la pharmacie", "Délégué / laboratoire", "Autre"];
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "carte", label: "Carte" },
];

type Line = { productId: string; qty: number; unitPrice: number; discountPct: number };
type Mode = "existant" | "nouveau" | "passage";

export default function CounterSalePage() {
  const { db, run, today, establishment, can } = useDemo();
  const [mode, setMode] = useState<Mode>("existant");
  const [q, setQ] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [nc, setNc] = useState({ name: "", phone: "", city: "", referredBy: "", acquisition: "" });
  const [herdOpen, setHerdOpen] = useState(true);
  const [herd, setHerd] = useState<Record<string, string>>({});
  const [farm, setFarm] = useState({ name: "", location: "" });
  const [pq, setPq] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [species, setSpecies] = useState("");
  const [wk, setWk] = useState({ name: "", phone: "" });
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("especes");
  const [received, setReceived] = useState("");
  const [done, setDone] = useState<{ code: string; total: number; clientName: string; clientId?: string; invoiceId?: string; lines: Line[] } | null>(null);
  const [rxOpen, setRxOpen] = useState(false);

  const matches = useMemo(() => findClients(db, q), [db, q]);
  const dupOfNew = nc.phone.replace(/\D/g, "").length >= 8 ? db.clients.find((c) => !c.isWalkIn && phoneKey(c.phone) === phoneKey(nc.phone)) : undefined;
  const clientFarm = client ? db.farms.find((f) => f.clientId === client.id) : undefined;
  const latestHerd = clientFarm
    ? clientFarm.lots.filter((l) => l.status === "actif").map((l) => ({ species: l.species, count: [...clientFarm.headcounts].filter((h) => h.lotId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.count ?? 0 }))
    : [];

  const products = db.products.filter((p) => p.status === "actif" && p.salePrice > 0);
  const needle = pq.trim().toLowerCase();
  const hits = needle.length >= 2 ? products.filter((p) => `${p.name} ${p.brandName ?? ""} ${p.activeIngredient ?? ""} ${p.code} ${shelfLabel(p.shelf)}`.toLowerCase().includes(needle)).slice(0, 8) : [];
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)), 0);
  const recv = Number(received.replace(/\s/g, "")) || 0;
  const account = db.accounts.find((a) => (method === "especes" ? a.type === "caisse" && a.establishmentId === establishment?.id : method === "mobile_money" ? a.type === "mobile_money" : a.type === "banque"));
  const herdList = HERD_SPECIES.map((s) => ({ species: s, count: Number(herd[s] || 0) })).filter((h) => h.count > 0);
  const stockOf = (id: string) => (establishment ? productStock(db, id, establishment.id, today) : 0);

  const add = (id: string) => {
    const p = products.find((x) => x.id === id)!;
    setLines((ls) => (ls.some((l) => l.productId === id) ? ls.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { productId: id, qty: 1, unitPrice: p.salePrice, discountPct: 0 }]));
    setPq("");
  };
  const reset = () => {
    setMode("existant");
    setQ("");
    setClient(null);
    setWk({ name: "", phone: "" });
    setNc({ name: "", phone: "", city: "", referredBy: "", acquisition: "" });
    setHerd({});
    setFarm({ name: "", location: "" });
    setLines([]);
    setSpecies("");
    setPurpose("");
    setReceived("");
  };
  const canSell = lines.length > 0 && (mode === "passage" || (mode === "existant" && client) || (mode === "nouveau" && nc.name.trim() && nc.phone.trim() && !dupOfNew)) && (mode !== "passage" || recv >= total);
  const submit = () => {
    const r = run(counterSale, {
      clientId: mode === "existant" ? client?.id : undefined,
      newClient: mode === "nouveau" ? nc : undefined,
      herd: mode === "passage" ? [] : herdList,
      farm: { name: farm.name, location: farm.location || (mode === "nouveau" ? nc.city : client?.city ?? "") },
      lines,
      payment: { method, accountId: account?.id ?? "", amount: Math.min(recv || total, total) },
      species: species || undefined,
      purpose,
      walkIn: mode === "passage" ? wk : undefined,
      opKey: uid("cs"),
    });
    if (r.ok && r.data) {
      const inv = r.db.invoices.find((i) => i.id === r.data!.invoiceId);
      setDone({ code: inv?.code ?? "", total, clientName: r.db.clients.find((c) => c.id === r.data!.clientId)?.name ?? "", clientId: r.data.clientId, invoiceId: r.data.invoiceId, lines });
      reset();
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Vente pharmacie" subtitle={`Comptoir · ${establishment?.name ?? ""} · le stock sort par lot à péremption la plus proche`} trail={[{ label: "Pharmacie", href: "/stock" }]} />

      {done && (
        <div className="cliva-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-200 bg-success-25 px-4 py-3 dark:border-success-800 dark:bg-success-500/10">
          <p className="text-sm text-success-800 dark:text-success-200">
            Vente <strong>{done.code}</strong> enregistrée · {formatXOF(done.total)} · {done.clientName}
          </p>
          <div className="flex flex-wrap gap-2">
            {can("prescriptions", "create") && done.clientId && done.invoiceId && (
              db.patients.some((p) => p.ownerId === done.clientId && p.vitalStatus === "vivant")
                ? <Button size="sm" variant="outline" onClick={() => setRxOpen(true)}>Faire l&apos;ordonnance de cette vente</Button>
                : <span className="self-center text-theme-xs text-gray-500">Pour une ordonnance, enregistrez d&apos;abord l&apos;animal du client.</span>
            )}
            <Button size="sm" variant="soft" onClick={() => setDone(null)}>Nouvelle vente</Button>
          </div>
        </div>
      )}
      {done?.clientId && done.invoiceId && (
        <PrescriptionModal
          isOpen={rxOpen}
          onClose={() => setRxOpen(false)}
          patientId=""
          clientId={done.clientId}
          sale={{ invoiceId: done.invoiceId }}
          presetLines={done.lines.map((l) => ({ productId: l.productId, quantity: l.qty }))}
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:gap-6">
        {/* Client */}
        <section className="space-y-4 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 xl:col-span-2 dark:border-gray-800 dark:bg-white/3">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">1. Client</h2>
            <div role="group" aria-label="Type de client" className="grid grid-cols-3 rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
              {(["existant", "nouveau", "passage"] as Mode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setClient(null); }} aria-pressed={mode === m} className={cn("rounded-md px-2 py-1.5 text-theme-xs font-medium whitespace-nowrap transition", mode === m ? "bg-gray-800 text-white dark:bg-white/15" : "text-gray-600 dark:text-gray-400")}>
                  {m === "existant" ? "Déjà client" : m === "nouveau" ? "Nouveau" : "De passage"}
                </button>
              ))}
            </div>
          </div>

          {mode === "existant" && (
            <div className="space-y-2">
              {client ? (
                <div className="rounded-xl border border-brand-200 bg-brand-25 p-3 dark:border-brand-800 dark:bg-brand-500/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-gray-800 hover:underline dark:text-white/90">{client.name}</Link>
                      <p className="text-theme-xs text-gray-600 dark:text-gray-400">{client.phoneCode} {client.phone} · {client.city}</p>
                    </div>
                    <button onClick={() => setClient(null)} className="text-theme-xs font-medium text-brand-600">Changer</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {activitiesOf(db, client).map((a) => <span key={a} className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", ACTIVITY_META[a].cls)}>{ACTIVITY_META[a].short}</span>)}
                  </div>
                  {latestHerd.length > 0 && <p className="mt-2 text-theme-xs text-gray-600 dark:text-gray-400">Cheptel connu : {latestHerd.map((h) => `${h.species} ${h.count}`).join(" · ")}{clientFarm?.location ? ` · ${clientFarm.location}` : ""}</p>}
                </div>
              ) : (
                <>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Téléphone, nom ou nom de la ferme" aria-label="Rechercher un client" className={input} autoFocus />
                  <ul className="space-y-1">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setClient(c)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-start hover:border-brand-300 hover:bg-brand-25 dark:border-gray-800 dark:hover:bg-white/5">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{c.name}</span>
                            <span className="text-theme-xs text-gray-500">{c.phone} · {c.city}</span>
                          </span>
                          <span className="flex gap-1">{activitiesOf(db, c).map((a) => <span key={a} className={cn("size-2 rounded-full", ACTIVITY_META[a].dot)} title={ACTIVITY_META[a].label} />)}</span>
                        </button>
                      </li>
                    ))}
                    {q.trim().length >= 2 && matches.length === 0 && (
                      <li className="text-theme-xs text-gray-500">
                        Aucun client trouvé. <button onClick={() => { setMode("nouveau"); setNc({ ...nc, phone: /\d/.test(q) ? q : "", name: /\d/.test(q) ? "" : q }); }} className="font-medium text-brand-600">Le créer</button>
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

          {mode === "nouveau" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input aria-label="Téléphone" placeholder="Téléphone *" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} className={input} />
              <input aria-label="Nom" placeholder="Nom et prénom *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} className={input} />
              {dupOfNew && (
                <p className="rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-800 sm:col-span-2 dark:bg-warning-500/10 dark:text-warning-300">
                  Ce numéro appartient déjà à <strong>{dupOfNew.name}</strong>.{" "}
                  <button onClick={() => { setMode("existant"); setClient(dupOfNew); }} className="font-medium underline">Utiliser ce client</button>
                </p>
              )}
              <input aria-label="Commune ou village" placeholder="Commune ou village" value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} className={input} />
              <select aria-label="Comment nous a-t-il connus ?" value={nc.acquisition} onChange={(e) => setNc({ ...nc, acquisition: e.target.value })} className={input}>
                <option value="">Comment nous a-t-il connus ?</option>
                {ACQ.map((a) => <option key={a}>{a}</option>)}
              </select>
              <input aria-label="Recommandé par" placeholder="Recommandé par (nom)" value={nc.referredBy} onChange={(e) => setNc({ ...nc, referredBy: e.target.value })} className={cn(input, "sm:col-span-2")} />
            </div>
          )}

          {mode === "passage" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input aria-label="Téléphone du client de passage" inputMode="tel" placeholder="Téléphone (facultatif, pour le suivi)" value={wk.phone} onChange={(e) => setWk({ ...wk, phone: e.target.value })} className={input} />
                <input aria-label="Nom du client de passage" placeholder="Nom (facultatif)" value={wk.name} onChange={(e) => setWk({ ...wk, name: e.target.value })} className={input} />
              </div>
              {wk.phone.replace(/\D/g, "").length >= 8 && db.clients.some((c) => !c.isWalkIn && phoneKey(c.phone) === phoneKey(wk.phone)) && (
                <p className="rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
                  Ce numéro est déjà celui de <strong>{db.clients.find((c) => !c.isWalkIn && phoneKey(c.phone) === phoneKey(wk.phone))?.name}</strong>.{" "}
                  <button onClick={() => { setMode("existant"); setClient(db.clients.find((c) => !c.isWalkIn && phoneKey(c.phone) === phoneKey(wk.phone)) ?? null); }} className="font-medium underline">Vendre à ce client</button>
                </p>
              )}
              <p className="text-theme-xs text-gray-500">Vente sans fiche, réglée entièrement au comptoir. Le numéro est gardé sur la facture pour relancer ou créer la fiche plus tard.</p>
            </div>
          )}

          {mode !== "passage" && (
            <div className="rounded-xl border border-orange-200 bg-orange-25 dark:border-orange-900 dark:bg-orange-500/5">
              <button onClick={() => setHerdOpen(!herdOpen)} aria-expanded={herdOpen} className="flex w-full items-center justify-between px-3 py-2.5 text-start">
                <span>
                  <span className="block text-sm font-semibold text-orange-900 dark:text-orange-200">Profil éleveur</span>
                  <span className="block text-theme-xs text-orange-800/80 dark:text-orange-300/80">Quel cheptel, quel effectif, où se trouve la ferme</span>
                </span>
                <span className={cn("text-orange-700 transition-transform", herdOpen && "rotate-180")}>▾</span>
              </button>
              {herdOpen && (
                <div className="space-y-2 border-t border-orange-200 px-3 py-3 dark:border-orange-900">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {HERD_SPECIES.map((s) => (
                      <label key={s} className="block">
                        <span className="mb-0.5 flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400"><SpeciesIcon species={s} />{s}</span>
                        <input inputMode="numeric" placeholder="effectif" value={herd[s] ?? ""} onChange={(e) => setHerd({ ...herd, [s]: e.target.value.replace(/\D/g, "") })} className="h-9 w-full rounded-md border border-orange-200 bg-white px-2 text-sm tabular-nums dark:border-orange-900 dark:bg-gray-900 dark:text-white/90" />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input aria-label="Lieu de la ferme" placeholder="Lieu de la ferme (village, commune)" value={farm.location} onChange={(e) => setFarm({ ...farm, location: e.target.value })} className={input} />
                    <input aria-label="Nom de la ferme" placeholder="Nom de la ferme (facultatif)" value={farm.name} onChange={(e) => setFarm({ ...farm, name: e.target.value })} className={input} />
                  </div>
                  <p className="text-[11px] text-gray-500">Enregistré dans l&apos;exploitation du client (créée si besoin) : visible dans le module Rural.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Panier */}
        <section className="space-y-4 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 xl:col-span-3 dark:border-gray-800 dark:bg-white/3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">2. Produits</h2>
          <div className="relative">
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Produit, molécule, rayon (ex. : ivermectine, vaccin volaille)" aria-label="Rechercher un produit" className={input} />
            {hits.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                {hits.map((p) => {
                  const st = stockOf(p.id);
                  return (
                    <li key={p.id}>
                      <button disabled={st <= 0} onClick={() => add(p.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-white/5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{p.brandName ?? p.name}</span>
                          <span className="text-[11px] text-gray-500">{shelfLabel(p.shelf)} · {st} en stock</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatXOF(p.salePrice)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Recherchez un produit pour l&apos;ajouter au panier.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId)!;
                const st = stockOf(l.productId);
                const set = (patch: Partial<Line>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <li key={l.productId} className="cliva-rise flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{p.brandName ?? p.name}</span>
                      <span className={cn("text-[11px]", l.qty > st ? "text-error-600" : "text-gray-500")}>{st} en stock{p.humanUse ? " · usage humain" : ""}</span>
                    </span>
                    <span className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700">
                      <button aria-label="Moins" onClick={() => (l.qty > 1 ? set({ qty: l.qty - 1 }) : setLines(lines.filter((_, j) => j !== i)))} className="size-8 text-gray-600 dark:text-gray-400">−</button>
                      <input aria-label="Quantité" inputMode="numeric" value={l.qty} onChange={(e) => set({ qty: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} className="h-8 w-10 border-x border-gray-200 bg-transparent text-center text-sm tabular-nums dark:border-gray-700 dark:text-white/90" />
                      <button aria-label="Plus" onClick={() => set({ qty: l.qty + 1 })} className="size-8 text-gray-600 dark:text-gray-400">+</button>
                    </span>
                    <span className="w-20 text-end text-theme-xs text-gray-500 tabular-nums">× {formatXOF(l.unitPrice)}</span>
                    <label className="flex items-center gap-1 text-theme-xs text-gray-500">
                      Remise
                      <input aria-label="Remise %" inputMode="numeric" value={l.discountPct || ""} onChange={(e) => set({ discountPct: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} className="h-8 w-11 rounded-md border border-gray-200 bg-transparent px-1 text-end tabular-nums dark:border-gray-700 dark:text-white/90" />%
                    </label>
                    <span className="w-24 text-end text-sm font-semibold tabular-nums">{formatXOF(Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)))}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select aria-label="Pour quel animal" value={species} onChange={(e) => setSpecies(e.target.value)} className={input}>
              <option value="">Pour quel animal ? (facultatif)</option>
              {["Chien", "Chat", ...HERD_SPECIES].map((s) => <option key={s} value={s}>{speciesEmoji(s)} {s}</option>)}
            </select>
            <input aria-label="Problème rencontré" placeholder="Problème rencontré (ex. : toux, diarrhée, vermifugation)" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input} />
          </div>

          <div className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
              <span className="text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{formatXOF(total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {METHODS.map((m) => (
                <button key={m.value} onClick={() => setMethod(m.value)} aria-pressed={method === m.value} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", method === m.value ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                  {m.label}
                </button>
              ))}
              <input inputMode="numeric" aria-label="Montant reçu" placeholder={`Reçu (${total.toLocaleString("fr-FR")})`} value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d\s]/g, ""))} className="h-10 w-40 rounded-lg border border-gray-300 bg-white px-3 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
              {recv > total && <span className="text-sm text-gray-600 dark:text-gray-400">Monnaie : <strong className="tabular-nums">{formatXOF(recv - total)}</strong></span>}
              {recv > 0 && recv < total && mode !== "passage" && <span className="text-sm text-warning-700 dark:text-warning-400">Reste dû : <strong className="tabular-nums">{formatXOF(total - recv)}</strong></span>}
            </div>
            <Button className="w-full" disabled={!canSell} onClick={submit}>
              Valider la vente
            </Button>
            {!account && <p className="text-theme-xs text-error-600">Aucun compte d&apos;encaissement pour ce moyen de paiement dans l&apos;établissement.</p>}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <CounterSalesToday />
        <StockOutCard />
      </div>
      <AnnouncementCarousel placement="pharmacie" />
    </div>
  );
}
