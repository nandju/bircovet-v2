"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { PLACEMENTS } from "@/lib/announcements";
import { formatDate, formatXOF } from "@/lib/format";
import { campaignLive, campaignTotals, CLIENTELE_LABEL, LANG_LABEL, targets } from "@/lib/platform";
import { deleteCampaign, saveCampaign, type CampaignInput } from "@/lib/services/platformService";
import type { AdCampaign } from "@/lib/types";
import { cn } from "@/utils";
import { compressImage } from "@/utils/image";
import { useEffect, useState } from "react";

const EMPTY: CampaignInput = { title: "", sponsor: "", text: "", imageDataUrl: undefined, link: "", placements: ["dashboard"], from: undefined, to: undefined, active: true, target: { countries: [], languages: [], clienteles: [], clinicIds: [] }, price: undefined };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={cn("rounded-full border px-3 py-1 text-theme-sm", on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>{children}</button>;
}
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

function Editor({ value, onClose }: { value: CampaignInput | null; onClose: () => void }) {
  const { db, run } = useDemo();
  const [v, setV] = useState<CampaignInput>(EMPTY);
  const [err, setErr] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recharge le formulaire à l'ouverture
    if (value) setV(structuredClone(value));
  }, [value]);
  if (!value) return null;
  const clinics = db.platform?.clinics.filter((c) => c.status !== "prospect") ?? [];
  const reach = clinics.filter((c) => targets({ ...v, id: "", stats: {}, createdAt: "" } as AdCampaign, c));
  const countries = [...new Set(clinics.map((c) => c.country))].sort();
  const T = v.target;
  const setT = (p: Partial<CampaignInput["target"]>) => setV({ ...v, target: { ...T, ...p } });
  const onFile = async (f?: File) => {
    setErr("");
    if (!f) return;
    if (f.type === "image/gif") {
      if (f.size > 1_500_000) return setErr("GIF trop lourd : 1,5 Mo maximum.");
      const r = new FileReader();
      r.onload = () => setV((s) => ({ ...s, imageDataUrl: String(r.result) }));
      r.readAsDataURL(f);
      return;
    }
    try {
      const url = await compressImage(f, 1200, 0.8);
      setV((s) => ({ ...s, imageDataUrl: url }));
    } catch {
      setErr("Image illisible.");
    }
  };
  return (
    <AppModal isOpen onClose={onClose} size="xl" title={v.id ? "Modifier la campagne" : "Nouvelle campagne"} description="Elle s'affiche dans l'interface des cliniques ciblées, en premier, et ne peut pas être retirée par elles." footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(saveCampaign, { ...v, link: v.link || undefined }).ok && onClose()} disabled={!v.title.trim()}>Enregistrer</Button></>}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[14rem_1fr]">
          <div>
            <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
              {v.imageDataUrl ? <img src={v.imageDataUrl} alt="Aperçu" className="h-full w-full object-cover" /> : <span className="px-3 text-center text-theme-xs text-gray-500">Image ou GIF (16:9)</span>}
            </div>
            <label className="mt-2 inline-flex h-8 cursor-pointer items-center rounded-lg border border-gray-300 px-3 text-theme-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">Choisir un visuel<input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {err && <p className="mt-1 text-theme-xs text-error-600">{err}</p>}
          </div>
          <FormGrid>
            <TextField label="Annonceur" value={v.sponsor} onChange={(x) => setV({ ...v, sponsor: x })} placeholder="Ex. : Laboratoire X" />
            <TextField label="Titre" required value={v.title} onChange={(x) => setV({ ...v, title: x })} />
            <TextAreaField label="Texte" value={v.text} onChange={(x) => setV({ ...v, text: x })} rows={2} className="sm:col-span-2" />
            <TextField label="Lien" value={v.link ?? ""} onChange={(x) => setV({ ...v, link: x })} placeholder="https://…" className="sm:col-span-2" />
            <TextField label="Du" type="date" value={v.from ?? ""} onChange={(x) => setV({ ...v, from: x || undefined })} />
            <TextField label="Au" type="date" value={v.to ?? ""} onChange={(x) => setV({ ...v, to: x || undefined })} />
            <NumberField label="Prix facturé à l'annonceur (facultatif)" suffix="FCFA" value={v.price ?? NaN} onChange={(x) => setV({ ...v, price: Number.isNaN(x) ? undefined : x })} min={0} step={10000} className="sm:col-span-2" />
          </FormGrid>
        </div>
        <section className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Ciblage</h4>
            <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-theme-xs font-semibold text-white">{reach.length} clinique(s) touchée(s)</span>
          </div>
          <div><p className="mb-1 text-theme-xs text-gray-500">Emplacements</p><div className="flex flex-wrap gap-1.5">{PLACEMENTS.map((p) => <Chip key={p.key} on={v.placements.includes(p.key)} onClick={() => setV({ ...v, placements: toggle(v.placements, p.key) })}>{p.label}</Chip>)}</div></div>
          <div><p className="mb-1 text-theme-xs text-gray-500">Pays (aucun = tous)</p><div className="flex flex-wrap gap-1.5">{countries.map((c) => <Chip key={c} on={T.countries.includes(c)} onClick={() => setT({ countries: toggle(T.countries, c) })}>{c}</Chip>)}</div></div>
          <div className="flex flex-wrap gap-6">
            <div><p className="mb-1 text-theme-xs text-gray-500">Langue</p><div className="flex gap-1.5">{(["fr", "en"] as const).map((l) => <Chip key={l} on={T.languages.includes(l)} onClick={() => setT({ languages: toggle(T.languages, l) })}>{LANG_LABEL[l]}</Chip>)}</div></div>
            <div><p className="mb-1 text-theme-xs text-gray-500">Clientèle</p><div className="flex flex-wrap gap-1.5">{(["compagnie", "rente", "mixte"] as const).map((l) => <Chip key={l} on={T.clienteles.includes(l)} onClick={() => setT({ clienteles: toggle(T.clienteles, l) })}>{CLIENTELE_LABEL[l]}</Chip>)}</div></div>
          </div>
          <div><p className="mb-1 text-theme-xs text-gray-500">Ou des cliniques précises (prioritaire sur les critères)</p><div className="flex flex-wrap gap-1.5">{clinics.map((c) => <Chip key={c.id} on={T.clinicIds.includes(c.id)} onClick={() => setT({ clinicIds: toggle(T.clinicIds, c.id) })}>{c.name}</Chip>)}</div></div>
        </section>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="size-4 accent-brand-500" />Campagne active</label>
      </div>
    </AppModal>
  );
}

export default function CampaignsPage() {
  const { db, run, today } = useDemo();
  const p = db.platform;
  const [edit, setEdit] = useState<CampaignInput | null>(null);
  const [stats, setStats] = useState<string | null>(null);
  if (!p) return null;
  const sel = p.campaigns.find((c) => c.id === stats);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Campagnes publicitaires" subtitle="Publicités de partenaires poussées dans l'interface des cliniques clientes" trail={[{ label: "Console éditeur", href: "/editeur" }]} actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit(structuredClone(EMPTY))}>Nouvelle campagne</Button>} />
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {p.campaigns.map((c) => {
          const t = campaignTotals(c);
          const live = campaignLive(c, today);
          const reach = p.clinics.filter((x) => x.status !== "prospect" && targets(c, x)).length;
          return (
            <li key={c.id} className="cliva-rise flex gap-4 rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
              {/* eslint-disable-next-line @next/next/no-img-element -- visuel de la campagne */}
              {c.imageDataUrl ? <img src={c.imageDataUrl} alt="" className="h-24 w-36 shrink-0 rounded-xl object-cover" /> : <div className="h-24 w-36 shrink-0 rounded-xl bg-gray-100 dark:bg-white/5" />}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", live ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400")}>{live ? "En diffusion" : c.active ? "Programmée / terminée" : "Arrêtée"}</span>
                  <span className="text-[11px] text-gray-500">{c.sponsor}</span>
                </div>
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{c.title}</p>
                <p className="text-theme-xs text-gray-500">{reach} clinique(s) ciblée(s){c.from || c.to ? ` · ${c.from ? formatDate(c.from) : "…"} → ${c.to ? formatDate(c.to) : "…"}` : ""}{c.price ? ` · ${formatXOF(c.price)}` : ""}</p>
                <p className="text-theme-xs text-gray-700 tabular-nums dark:text-gray-300"><strong>{t.views}</strong> vues · <strong>{t.clicks}</strong> clics · taux de clic {t.ctr} % · vue dans {t.reach} clinique(s)</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="xs" variant="soft" onClick={() => setEdit(structuredClone(c))}>Modifier</Button>
                  <Button size="xs" variant="ghost" onClick={() => setStats(c.id)}>Détail par clinique</Button>
                  <Button size="xs" variant="ghost" onClick={() => run(saveCampaign, { ...c, active: !c.active })}>{c.active ? "Arrêter" : "Relancer"}</Button>
                  <Button size="xs" variant="ghost" className="text-error-600" onClick={() => run(deleteCampaign, { id: c.id })}>Supprimer</Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {!p.campaigns.length && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune campagne.</p>}
      <Editor value={edit} onClose={() => setEdit(null)} />
      {sel && (
        <AppModal isOpen onClose={() => setStats(null)} title={sel.title} description="Vues et clics par clinique (comptages anonymes : aucun utilisateur n'est identifié)">
          <table className="w-full text-sm">
            <thead><tr className="text-theme-xs text-gray-500"><th className="py-1 text-start font-medium">Clinique</th><th className="py-1 text-end font-medium">Vues</th><th className="py-1 text-end font-medium">Clics</th><th className="py-1 text-end font-medium">Taux</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {p.clinics.filter((x) => targets(sel, x) && x.status !== "prospect").map((x) => {
                const s = sel.stats[x.id] ?? { views: 0, clicks: 0 };
                return <tr key={x.id}><td className="py-1.5">{x.name} <span className="text-theme-xs text-gray-500">· {x.country}</span></td><td className="py-1.5 text-end tabular-nums">{s.views}</td><td className="py-1.5 text-end tabular-nums">{s.clicks}</td><td className="py-1.5 text-end tabular-nums">{s.views ? Math.round((s.clicks / s.views) * 1000) / 10 : 0} %</td></tr>;
              })}
            </tbody>
          </table>
        </AppModal>
      )}
    </div>
  );
}
