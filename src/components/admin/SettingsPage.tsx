"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useTheme } from "@/context/ThemeContext";
import { contrastRatio, DEFAULT_BRANDING, FONT_OPTIONS, isValidHex } from "@/lib/branding";
import { formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { updateSettings } from "@/lib/services/adminService";
import type { Branding, Settings } from "@/lib/types";
import { useEffect, useState } from "react";

const MAX_LOGO_SIZE = 400 * 1024; // 400 Ko — le logo est persisté en data URL dans les paramètres de l'organisation

export default function SettingsPage() {
  const { db, run } = useDemo();
  const { themeMode, setThemeMode } = useTheme();
  const [v, setV] = useState<Settings>(db.settings);
  const [expCats, setExpCats] = useState(db.settings.expenseCategories.join("\n"));
  useEffect(() => {
    setV(db.settings);
    setExpCats(db.settings.expenseCategories.join("\n"));
  }, [db.settings]);
  const set = <K extends keyof Settings>(k: K, x: Settings[K]) => setV((s) => ({ ...s, [k]: x }));
  const branding = v.branding ?? DEFAULT_BRANDING;
  const setBranding = (patch: Partial<Branding>) => set("branding", { ...branding, ...patch });
  const setColor = (k: keyof Branding["colors"], x: string) => setBranding({ colors: { ...branding.colors, [k]: x } });
  const [logoError, setLogoError] = useState("");
  const onLogoFile = (file: File | undefined) => {
    setLogoError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) return setLogoError("Format non pris en charge : PNG, JPG, WebP ou SVG.");
    if (file.size > MAX_LOGO_SIZE) return setLogoError("Fichier trop volumineux : 400 Ko maximum.");
    const reader = new FileReader();
    reader.onload = () => setBranding({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const [promoError, setPromoError] = useState("");
  const setPromo = (patch: Partial<Settings["promo"]>) => set("promo", { ...v.promo, ...patch });
  const onPromoFile = (file: File | undefined) => {
    setPromoError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setPromoError("Format non pris en charge : PNG, JPG ou WebP.");
    if (file.size > MAX_LOGO_SIZE) return setPromoError("Fichier trop volumineux : 400 Ko maximum.");
    const reader = new FileReader();
    reader.onload = () => setPromo({ imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const save = () => run(updateSettings, { ...v, expenseCategories: expCats.split("\n").map((x) => x.trim()).filter(Boolean) });

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Paramètres généraux" trail={[{ label: "Administration", href: "/administration/utilisateurs" }]} actions={<Button size="sm" onClick={save}>Enregistrer les paramètres</Button>} />
      <DemoNotice>Les valeurs métier non précisées (délégations, seuils, horizons) sont des hypothèses de démonstration paramétrables ; elles ne constituent pas une règle réglementaire.</DemoNotice>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <ComponentCard title="Identité et coordonnées de la clinique">
          <FormGrid>
            <TextField label="Nom commercial" value={v.clinicName} onChange={(x) => set("clinicName", x)} />
            <TextField label="Raison sociale (fictive)" value={v.legalName} onChange={(x) => set("legalName", x)} />
            <TextField label="Adresse" value={v.address} onChange={(x) => set("address", x)} className="sm:col-span-2" />
            <TextField label="Téléphone" value={v.phone} onChange={(x) => set("phone", x)} />
            <TextField label="E-mail" value={v.email} onChange={(x) => set("email", x)} />
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Devise, formats et affichage">
          <FormGrid>
            <TextField label="Devise" value={`${v.currency} — Franc CFA (ex. ${formatXOF(125000)})`} onChange={() => undefined} disabled />
            <SelectField label="Format de date" value={v.dateFormat} onChange={(x) => set("dateFormat", x as Settings["dateFormat"])} options={[{ value: "dd/MM/yyyy", label: "11/10/2026" }, { value: "dd MMM yyyy", label: "11 oct. 2026" }]} />
            <SelectField label="Thème" value={themeMode} onChange={(x) => setThemeMode(x as "light" | "dark" | "auto")} options={[{ value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }, { value: "auto", label: "Automatique (système)" }]} />
            <div className="flex items-end"><CheckField label="Tableaux compacts" checked={v.compactTables} onChange={(x) => set("compactTables", x)} /></div>
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Seuils et délégations">
          <FormGrid>
            <NumberField label="Horizon d'alerte de péremption" suffix="jours" value={v.expiryAlertDays} onChange={(x) => set("expiryAlertDays", x)} min={1} />
            <NumberField label="Délégation de remise" suffix="%" value={v.discountDelegationPct} onChange={(x) => set("discountDelegationPct", x)} min={0} max={100} hint="Au-delà : validation DG" />
            <NumberField label="Délégation de dépense" suffix="FCFA" value={v.expenseDelegationAmount} onChange={(x) => set("expenseDelegationAmount", x)} min={0} step={5000} hint="Au-delà : circuit de validation DG" />
          </FormGrid>
          <p className="text-theme-xs text-gray-500">Seuils d&apos;alerte de stock : définis article par article dans le catalogue.</p>
        </ComponentCard>
        <ComponentCard title="Rappels et notifications">
          <FormGrid>
            <NumberField label="Délai de rappel RDV par défaut" suffix="h" value={v.reminderDefaultHours} onChange={(x) => set("reminderDefaultHours", x)} min={1} />
            <SelectField label="Canal par défaut" value={v.reminderDefaultChannel} onChange={(x) => set("reminderDefaultChannel", x as Settings["reminderDefaultChannel"])} options={[{ value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-mail" }, { value: "appel", label: "Appel" }]} />
            <TextAreaField label="Note sur les rappels vaccinaux" value={v.vaccineReminderNote} onChange={(x) => set("vaccineReminderNote", x)} rows={2} className="sm:col-span-2" />
          </FormGrid>
          <CheckField label="Notifier les stocks faibles" checked={v.notifyLowStock} onChange={(x) => set("notifyLowStock", x)} />
          <CheckField label="Notifier les péremptions proches" checked={v.notifyExpiry} onChange={(x) => set("notifyExpiry", x)} />
          <CheckField label="Notifier les factures en retard" checked={v.notifyOverdueInvoices} onChange={(x) => set("notifyOverdueInvoices", x)} />
          <CheckField label="Notifier les tâches en retard" checked={v.notifyTasks} onChange={(x) => set("notifyTasks", x)} />
        </ComponentCard>
        <ComponentCard title="Modèles de documents">
          <FormGrid>
            <TextField label="Préfixe des factures (démo)" value={v.invoicePrefix} onChange={(x) => set("invoicePrefix", x)} />
            <TextField label="Préfixe des devis (démo)" value={v.quotePrefix} onChange={(x) => set("quotePrefix", x)} />
            <TextAreaField label="Mention de pied de document" value={v.documentFooter} onChange={(x) => set("documentFooter", x)} rows={2} className="sm:col-span-2" hint="La mention « DÉMONSTRATION — SANS VALEUR FISCALE » doit rester présente." />
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Personnalisation de la plateforme (Cliva)" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormGrid>
              <TextField label="Nom de la plateforme" value={branding.platformName} onChange={(x) => setBranding({ platformName: x })} />
              <SelectField label="Police de caractères" value={branding.font} onChange={(x) => setBranding({ font: x as Branding["font"] })} options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))} />
              <TextField label="Signature / slogan" value={branding.slogan} onChange={(x) => setBranding({ slogan: x })} className="sm:col-span-2" />
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Logo personnalisé</p>
                <div className="flex flex-wrap items-center gap-3">
                  {branding.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu de logo (data URL local)
                    <img src={branding.logoDataUrl} alt="Logo" className="size-12 rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
                  ) : (
                    <span className="text-theme-sm text-gray-400">Logo Cliva par défaut</span>
                  )}
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                    Importer…
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0])} />
                  </label>
                  {branding.logoDataUrl && <Button size="sm" variant="outline" onClick={() => setBranding({ logoDataUrl: "" })}>Supprimer</Button>}
                </div>
                {logoError ? <p className="mt-1 text-theme-xs text-error-500">{logoError}</p> : <p className="mt-1 text-theme-xs text-gray-400">PNG, JPG, WebP ou SVG — 400 Ko max. Le fichier original du projet n&apos;est pas modifié.</p>}
              </div>
            </FormGrid>
            <div className="space-y-4">
              <FormGrid>
                {([["primary", "Couleur principale"], ["secondary", "Secondaire"], ["tertiary", "Accentuation"]] as const).map(([k, lbl]) => (
                  <div key={k}>
                    <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">{lbl}</p>
                    <div className="flex items-center gap-2">
                      <input type="color" value={isValidHex(branding.colors[k]) && branding.colors[k].length === 7 ? branding.colors[k] : "#888888"} onChange={(e) => setColor(k, e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-gray-300 bg-transparent p-0.5 dark:border-gray-700" />
                      <TextField label="" value={branding.colors[k]} onChange={(x) => setColor(k, x)} className="flex-1" />
                    </div>
                  </div>
                ))}
              </FormGrid>
              {isValidHex(branding.colors.primary) && contrastRatio(branding.colors.primary, "#FFFFFF") < 3 && (
                <p className="rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                  Attention : la couleur principale est très claire — les libellés blancs sur les boutons peuvent devenir illisibles.
                </p>
              )}
              {/* Aperçu temps réel */}
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="mb-2 text-theme-xs font-medium uppercase tracking-wide text-gray-400">Aperçu</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-theme-xs">Bouton principal</span>
                  <span className="rounded-lg bg-secondary-500 px-3 py-1.5 text-sm font-medium text-white shadow-theme-xs">Secondaire</span>
                  <span className="rounded-lg bg-tertiary-500 px-3 py-1.5 text-sm font-medium text-white shadow-theme-xs">Accentuation</span>
                  <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">Survol / fond</span>
                </div>
                <p className="mt-3 text-theme-xs text-gray-400">L&apos;aperçu reflète les couleurs actuellement enregistrées. Les changements s&apos;appliquent à l&apos;enregistrement.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setBranding({ ...DEFAULT_BRANDING })}>Restaurer l&apos;identité Cliva par défaut</Button>
            </div>
          </div>
        </ComponentCard>
        <ComponentCard title="Encart d'annonce du tableau de bord" className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-4">
            <CheckField label="Afficher l'encart sur le tableau de bord" checked={v.promo.active} onChange={(x) => setPromo({ active: x })} />
            <p className="text-theme-xs text-gray-400">Emplacement discret, optionnel — ne masque aucune information médicale.</p>
          </div>
          <FormGrid>
            <TextField label="Titre" value={v.promo.title} onChange={(x) => setPromo({ title: x })} placeholder="Ex. Offre vaccination des élevages" />
            <TextField label="Lien (route interne ou URL)" value={v.promo.link ?? ""} onChange={(x) => setPromo({ link: x })} placeholder="/stock/catalogue" />
            <TextAreaField label="Courte description" value={v.promo.text} onChange={(x) => setPromo({ text: x })} rows={2} className="sm:col-span-2" />
            <TextField label="Afficher à partir du" type="date" value={v.promo.from ?? ""} onChange={(x) => setPromo({ from: x })} />
            <TextField label="Jusqu'au" type="date" value={v.promo.to ?? ""} onChange={(x) => setPromo({ to: x })} />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Image (optionnelle)</p>
              <div className="flex flex-wrap items-center gap-3">
                {v.promo.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu d'image d'annonce (data URL local)
                  <img src={v.promo.imageDataUrl} alt="Annonce" className="h-14 rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
                ) : (
                  <span className="text-theme-sm text-gray-400">Aucune image</span>
                )}
                <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                  Importer…
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPromoFile(e.target.files?.[0])} />
                </label>
                {v.promo.imageDataUrl && <Button size="sm" variant="outline" onClick={() => setPromo({ imageDataUrl: "" })}>Supprimer</Button>}
              </div>
              {promoError ? <p className="mt-1 text-theme-xs text-error-500">{promoError}</p> : <p className="mt-1 text-theme-xs text-gray-400">PNG, JPG ou WebP — 400 Ko max.</p>}
            </div>
          </FormGrid>
        </ComponentCard>
        <ComponentCard title="Catégories">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Catégories de produits</p>
            <div className="flex flex-wrap gap-1.5">
              {v.productCategories.map((c) => <span key={c} className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs dark:bg-white/5">{labelOf("category", c)}</span>)}
            </div>
          </div>
          <TextAreaField label="Catégories de dépenses (une par ligne)" value={expCats} onChange={setExpCats} rows={5} />
        </ComponentCard>
      </div>
      <div className="flex justify-end">
        <Button onClick={save}>Enregistrer les paramètres</Button>
      </div>
    </div>
  );
}
