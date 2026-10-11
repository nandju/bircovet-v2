"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useTheme } from "@/context/ThemeContext";
import { formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { updateSettings } from "@/lib/services/adminService";
import type { Settings } from "@/lib/types";
import { useEffect, useState } from "react";

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
