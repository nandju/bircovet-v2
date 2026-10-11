"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { uid } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createClient, findDuplicates, updateClient, type ClientInput } from "@/lib/services/clientsService";
import type { Client } from "@/lib/types";
import { useMemo, useState } from "react";

const EMPTY: ClientInput = {
  type: "particulier",
  name: "",
  phoneCode: "+225",
  phone: "",
  email: "",
  address: "",
  city: "",
  contacts: [],
  commPrefs: { sms: true, whatsapp: false, email: false, call: false },
  segment: "standard",
  payerName: "",
  payerTaxId: "",
};

export default function ClientForm({ clientId }: { clientId?: string }) {
  const { db, run } = useDemo();
  const router = useRouter();
  const existing = clientId ? db.clients.find((c) => c.id === clientId) : undefined;
  const [v, setV] = useState<ClientInput>(() => (existing ? { ...EMPTY, ...pick(existing) } : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ClientInput>(k: K, val: ClientInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const duplicates = useMemo(() => (v.name.length > 3 || v.phone.replace(/\D/g, "").length >= 8 ? findDuplicates(db, { id: clientId ?? "", name: v.name, phone: v.phone }) : []), [db, v.name, v.phone, clientId]);

  if (clientId && !existing) return <p className="text-sm text-gray-500">Client introuvable.</p>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!v.name.trim()) errs.name = "Obligatoire.";
    if (!/^[0-9 ]{8,}$/.test(v.phone.trim())) errs.phone = "Au moins 8 chiffres.";
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) errs.email = "E-mail invalide.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const input = { ...v, payerName: v.payerName || v.name };
    if (existing) {
      const r = run(updateClient, { id: existing.id, patch: input });
      if (r.ok) router.push(`/clients/${existing.id}`);
    } else {
      const r = run(createClient, input);
      if (r.ok && r.data) router.push(`/clients/${r.data}`);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageBreadcrumb pageTitle={existing ? `Modifier — ${existing.name}` : "Nouveau client"} trail={[{ label: "Clients", href: "/clients" }]} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 xl:col-span-2 xl:space-y-6">
          <ComponentCard title="Identité et coordonnées">
            {duplicates.length > 0 && (
              <DemoNotice tone="warning">
                Doublon potentiel détecté :{" "}
                {duplicates.map((d) => (
                  <Link key={d.id} href={`/clients/${d.id}`} className="font-medium underline">
                    {d.name} ({d.code})
                  </Link>
                ))}
                . Vérifiez avant d&apos;enregistrer ; une fusion supervisée reste possible ensuite.
              </DemoNotice>
            )}
            <FormGrid>
              <SelectField label="Type" required value={v.type} onChange={(x) => set("type", x as ClientInput["type"])} options={optionsOf("clientType")} />
              <SelectField label="Segment client" value={v.segment} onChange={(x) => set("segment", x as ClientInput["segment"])} options={optionsOf("segment")} />
              <TextField className="sm:col-span-2" label={v.type === "entreprise" ? "Raison sociale" : "Nom et prénoms"} required value={v.name} onChange={(x) => set("name", x)} error={errors.name} />
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <TextField label="Indicatif" value={v.phoneCode} onChange={(x) => set("phoneCode", x)} />
                <TextField label="Téléphone" required type="tel" value={v.phone} onChange={(x) => set("phone", x)} error={errors.phone} placeholder="07 00 00 00 00" />
              </div>
              <TextField label="E-mail" type="email" value={v.email} onChange={(x) => set("email", x)} error={errors.email} />
              <TextField label="Ville / commune" value={v.city} onChange={(x) => set("city", x)} />
              <TextField label="Adresse" value={v.address} onChange={(x) => set("address", x)} />
            </FormGrid>
          </ComponentCard>
          <ComponentCard
            title="Contacts complémentaires"
            actions={
              <Button size="xs" variant="outline" startIcon={<PlusIcon />} onClick={() => set("contacts", [...v.contacts, { id: uid("cc"), name: "", phone: "", relation: "" }])}>
                Ajouter
              </Button>
            }
          >
            {v.contacts.length === 0 && <p className="text-sm text-gray-500">Aucun contact complémentaire.</p>}
            {v.contacts.map((c, i) => (
              <div key={c.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <TextField label="Nom" value={c.name} onChange={(x) => set("contacts", v.contacts.map((y, j) => (j === i ? { ...y, name: x } : y)))} />
                <TextField label="Téléphone" value={c.phone} onChange={(x) => set("contacts", v.contacts.map((y, j) => (j === i ? { ...y, phone: x } : y)))} />
                <TextField label="Lien / fonction" value={c.relation} onChange={(x) => set("contacts", v.contacts.map((y, j) => (j === i ? { ...y, relation: x } : y)))} />
                <Button variant="ghost" size="sm" onClick={() => set("contacts", v.contacts.filter((_, j) => j !== i))} title="Retirer">
                  <TrashBinIcon className="size-4" />
                </Button>
              </div>
            ))}
          </ComponentCard>
        </div>
        <div className="space-y-4 xl:space-y-6">
          <ComponentCard title="Préférences de communication" desc="Utilisées pour les rappels simulés">
            <CheckField label="SMS" checked={v.commPrefs.sms} onChange={(x) => set("commPrefs", { ...v.commPrefs, sms: x })} />
            <CheckField label="WhatsApp" checked={v.commPrefs.whatsapp} onChange={(x) => set("commPrefs", { ...v.commPrefs, whatsapp: x })} />
            <CheckField label="E-mail" checked={v.commPrefs.email} onChange={(x) => set("commPrefs", { ...v.commPrefs, email: x })} />
            <CheckField label="Appel téléphonique" checked={v.commPrefs.call} onChange={(x) => set("commPrefs", { ...v.commPrefs, call: x })} />
          </ComponentCard>
          <ComponentCard title="Informations du payeur">
            <TextField label="Nom du payeur" value={v.payerName} onChange={(x) => set("payerName", x)} hint="Par défaut : nom du client" />
            <TextField label="N° contribuable (fictif)" value={v.payerTaxId} onChange={(x) => set("payerTaxId", x)} />
          </ComponentCard>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button type="submit">{existing ? "Enregistrer les modifications" : "Créer le client"}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function pick(c: Client): ClientInput {
  const { type, name, phoneCode, phone, email, address, city, contacts, commPrefs, segment, payerName, payerTaxId } = c;
  return { type, name, phoneCode, phone, email, address, city, contacts, commPrefs, segment, payerName, payerTaxId };
}
