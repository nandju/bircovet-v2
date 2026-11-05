"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { PLACEMENTS } from "@/lib/announcements";
import { platformAnnouncements } from "@/lib/platform";
import { formatDate } from "@/lib/format";
import { deleteAnnouncement, moveAnnouncement, saveAnnouncement, type AnnouncementInput } from "@/lib/services/adminService";
import type { Announcement } from "@/lib/types";
import { cn } from "@/utils";
import { compressImage } from "@/utils/image";
import { useEffect, useState } from "react";

const MAX_GIF = 1_500_000;
const EMPTY: AnnouncementInput = { kind: "pub", sponsor: "", title: "", text: "", imageDataUrl: undefined, link: "", placements: ["dashboard"], from: undefined, to: undefined, active: true };

function Editor({ value, onClose }: { value: AnnouncementInput | null; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState<AnnouncementInput>(EMPTY);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (value) {
      setV(value);
      setErr("");
    }
  }, [value]);
  if (!value) return null;
  const onFile = async (f?: File) => {
    setErr("");
    if (!f) return;
    if (f.type === "image/gif") {
      // Un GIF est gardé tel quel pour conserver l'animation.
      if (f.size > MAX_GIF) return setErr("GIF trop lourd : 1,5 Mo maximum (le navigateur stocke les données de démonstration).");
      const r = new FileReader();
      r.onload = () => setV((s) => ({ ...s, imageDataUrl: String(r.result) }));
      r.readAsDataURL(f);
      return;
    }
    try {
      const url = await compressImage(f, 1200, 0.8);
      setV((s) => ({ ...s, imageDataUrl: url }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Image illisible.");
    }
  };
  const togglePlace = (k: Announcement["placements"][number]) => setV({ ...v, placements: v.placements.includes(k) ? v.placements.filter((x) => x !== k) : [...v.placements, k] });
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={v.id ? "Modifier l'annonce" : "Nouvelle annonce"}
      description="Publicité d'un laboratoire partenaire ou actualité de la clinique, affichée en rotation."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => run(saveAnnouncement, { ...v, link: v.link?.trim() || undefined, sponsor: v.sponsor?.trim() || undefined }).ok && onClose()}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[14rem_1fr]">
          <div>
            <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
              {v.imageDataUrl ? <img src={v.imageDataUrl} alt="Aperçu" className="h-full w-full object-cover" /> : <span className="px-3 text-center text-theme-xs text-gray-500">Image ou GIF animé (16:9 conseillé)</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cliva-press inline-flex h-8 cursor-pointer items-center rounded-lg border border-gray-300 px-3 text-theme-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                Choisir un fichier
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {v.imageDataUrl && <Button size="xs" variant="ghost" onClick={() => setV({ ...v, imageDataUrl: undefined })}>Retirer</Button>}
            </div>
            {err && <p className="mt-1 text-theme-xs text-error-600">{err}</p>}
          </div>
          <FormGrid cols={1}>
            <SelectField label="Type" value={v.kind} onChange={(x) => setV({ ...v, kind: x as Announcement["kind"] })} options={[{ value: "pub", label: "Publicité partenaire" }, { value: "actualite", label: "Actualité de la clinique" }]} />
            {v.kind === "pub" && <TextField label="Laboratoire / partenaire" value={v.sponsor ?? ""} onChange={(x) => setV({ ...v, sponsor: x })} placeholder="Ex. : Laboratoire X" />}
            <TextField label="Titre" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
          </FormGrid>
        </div>
        <FormGrid>
          <TextAreaField label="Texte" value={v.text} onChange={(x) => setV({ ...v, text: x })} rows={2} className="sm:col-span-2" />
          <TextField label="Lien de redirection" value={v.link ?? ""} onChange={(x) => setV({ ...v, link: x })} placeholder="https://… ou /stock/vente" className="sm:col-span-2" />
          <TextField label="Afficher à partir du" type="date" value={v.from ?? ""} onChange={(x) => setV({ ...v, from: x || undefined })} />
          <TextField label="Jusqu'au" type="date" value={v.to ?? ""} onChange={(x) => setV({ ...v, to: x || undefined })} />
        </FormGrid>
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Emplacements</p>
          <div className="flex flex-wrap gap-2">
            {PLACEMENTS.map((p) => (
              <button key={p.key} type="button" onClick={() => togglePlace(p.key)} aria-pressed={v.placements.includes(p.key)} className={cn("rounded-full border px-3 py-1 text-sm", v.placements.includes(p.key) ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <CheckField label="Annonce active" checked={v.active} onChange={(x) => setV({ ...v, active: x })} />
      </div>
    </AppModal>
  );
}

export default function AnnouncementsPage() {
  const { db, run, user, today } = useDemo();
  const [edit, setEdit] = useState<AnnouncementInput | null>(null);
  const list = [...(db.announcements ?? [])].sort((a, b) => a.order - b.order);
  const isDG = user?.roleId === "dg";
  const cliva = [...new Map((["dashboard", "connexion", "pharmacie"] as const).flatMap((pl) => platformAnnouncements(db, pl, today)).map((c) => [c.id, c])).values()];
  const live = (a: Announcement) => a.active && (!a.from || a.from <= today) && (!a.to || a.to >= today);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Annonces et partenaires"
        subtitle="Publicités de laboratoires et actualités affichées en rotation dans l'application"
        trail={[{ label: "Administration", href: "/administration/parametres" }]}
        actions={isDG && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({ ...EMPTY })}>Nouvelle annonce</Button>}
      />
      {!isDG && <p className="text-sm text-gray-500">Consultation seule : la gestion des annonces est réservée au DG.</p>}
      {cliva.length > 0 && (
        <section className="rounded-3xl border border-brand-200 bg-brand-25 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Diffusées par Cliva</p>
          <p className="mb-2 text-theme-xs text-gray-500">Publicités de partenaires prévues par votre licence : elles s&apos;affichent avant vos annonces et ne peuvent pas être retirées.</p>
          <ul className="flex flex-wrap gap-2">
            {cliva.map((c) => <li key={c.id} className="rounded-full bg-white px-3 py-1 text-theme-sm text-gray-700 shadow-theme-xs dark:bg-gray-900 dark:text-gray-300">{c.title} <span className="text-gray-500">· {c.sponsor}</span></li>)}
          </ul>
        </section>
      )}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((a, k) => (
          <li key={a.id} className="cliva-rise flex gap-4 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-3 dark:border-gray-800 dark:bg-white/3">
            {/* eslint-disable-next-line @next/next/no-img-element -- image de l'annonce */}
            {a.imageDataUrl ? <img src={a.imageDataUrl} alt="" className="h-24 w-40 shrink-0 rounded-xl object-cover" /> : <div className="h-24 w-40 shrink-0 rounded-xl bg-gray-100 dark:bg-white/5" />}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", live(a) ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400")}>{live(a) ? "En diffusion" : a.active ? "Programmée / expirée" : "Désactivée"}</span>
                <span className="text-[11px] text-gray-500">{a.kind === "pub" ? `Pub${a.sponsor ? ` · ${a.sponsor}` : ""}` : "Actualité"}</span>
              </div>
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{a.title}</p>
              <p className="text-theme-xs text-gray-500">
                {a.placements.map((p) => PLACEMENTS.find((x) => x.key === p)?.label).join(", ")}
                {a.from || a.to ? ` · ${a.from ? formatDate(a.from) : "…"} → ${a.to ? formatDate(a.to) : "…"}` : ""}
              </p>
              <p className="text-theme-xs text-gray-600 tabular-nums dark:text-gray-400">
                <strong>{a.views}</strong> vue(s) · <strong>{a.clicks}</strong> clic(s) · taux de clic {a.views ? Math.round((a.clicks / a.views) * 1000) / 10 : 0} %
              </p>
              {isDG && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="xs" variant="soft" onClick={() => setEdit({ ...a })}>Modifier</Button>
                  <Button size="xs" variant="ghost" disabled={k === 0} onClick={() => run(moveAnnouncement, { id: a.id, dir: -1 }, { silent: true })}>Monter</Button>
                  <Button size="xs" variant="ghost" disabled={k === list.length - 1} onClick={() => run(moveAnnouncement, { id: a.id, dir: 1 }, { silent: true })}>Descendre</Button>
                  <Button size="xs" variant="ghost" className="text-error-600" onClick={() => run(deleteAnnouncement, { id: a.id })}>Supprimer</Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune annonce.</p>}
      <Editor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
