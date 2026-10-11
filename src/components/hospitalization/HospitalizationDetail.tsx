"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import LinkedDocuments from "@/components/documents/LinkedDocuments";
import PaymentModal from "@/components/finances/PaymentModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import TextArea from "@/components/form/input/TextArea";
import { DeliveryModal, PrescriptionModal } from "@/components/prescriptions/PrescriptionModals";
import PrescriptionsTable from "@/components/prescriptions/PrescriptionsTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { Link, useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName, docTotal, invoiceBalance, invoicePaid, patientName, productName, userName } from "@/lib/calc";
import { addDays, formatDate, formatDateTime, formatXOF, uid } from "@/lib/format";
import {
  addCarePlanItem,
  addObservation,
  addTransmission,
  closeStay,
  completeFollowUp,
  dischargePatient,
  invoiceStay,
  provisionalLines,
  recordCareAct,
  setConsent,
  stayDays,
  toggleCarePlan,
} from "@/lib/services/hospitalizationsService";
import type { Prescription } from "@/lib/types";
import { useState } from "react";

export default function HospitalizationDetail({ id }: { id: string }) {
  const { db, run, can, today } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const [tab, setTab] = useState("sejour");
  const [obs, setObs] = useState("");
  const [trn, setTrn] = useState({ text: "", shift: "Jour → Nuit" });
  const [care, setCare] = useState({ label: "", productId: "", qty: 1, bill: true, billLabel: "", price: 0, opKey: "" });
  const [plan, setPlan] = useState({ label: "", schedule: "" });
  const [discharge, setDischarge] = useState({ notes: "", followUpDate: "", followUpNotes: "" });
  const [consentBy, setConsentBy] = useState("");
  const [deliver, setDeliver] = useState<Prescription | null>(null);
  const careModal = useModal();
  const dischargeModal = useModal();
  const rx = useModal();
  const pay = useModal();
  const h = db.hospitalizations.find((x) => x.id === id);
  if (!h) return <p className="text-sm text-gray-500">Séjour introuvable.</p>;
  const open = h.status === "en_cours";
  const inv = db.invoices.find((i) => i.id === h.invoiceId);
  const provisional = provisionalLines(h, today);
  const provisionalTotal = provisional.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const quote = db.quotes.find((q) => q.id === h.quoteId);
  const prescriptions = db.prescriptions.filter((p) => p.hospitalizationId === h.id);
  const editable = can("hospitalisation", "update");

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`${h.code} — ${patientName(db, h.patientId)}`}
        subtitle={`${h.cage} · admis le ${formatDateTime(h.admittedAt)} · ${stayDays(h, today)} jour(s)`}
        trail={[{ label: "Hospitalisation", href: "/hospitalisation" }]}
        actions={
          <>
            {open && editable && (
              <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => { setCare({ label: "", productId: "", qty: 1, bill: true, billLabel: "", price: 0, opKey: uid("care") }); careModal.openModal(); }}>
                Soin effectué
              </Button>
            )}
            {open && can("hospitalisation", "validate") && (
              <Button size="sm" variant="secondary" onClick={() => { setDischarge({ notes: "", followUpDate: addDays(today, 3), followUpNotes: "" }); dischargeModal.openModal(); }}>
                Sortie médicale
              </Button>
            )}
            {!h.invoiceId && can("facturation", "create") && (
              <Button size="sm" onClick={() => { const r = run(invoiceStay, { id: h.id }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
                Préfacturer
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Statut médical", <StatusBadge key="s" kind="hospitalization" value={h.status} />],
          ["Lignes provisoires", formatXOF(provisionalTotal)],
          ["Facture", inv ? <Link key="i" className="text-brand-600 hover:underline" href={`/facturation/factures/${inv.id}`}>{inv.code}</Link> : "Non émise"],
          ["Payé", inv ? formatXOF(invoicePaid(db, inv.id)) : "—"],
          ["Solde restant", inv ? <span key="b" className={invoiceBalance(db, inv) > 0 ? "text-error-600" : "text-success-600"}>{formatXOF(invoiceBalance(db, inv))}</span> : "—"],
        ].map(([l, v], i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">{l}</p>
            <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">{v}</div>
          </div>
        ))}
      </div>
      {h.status === "sortie_medicale" && <DemoNotice tone="warning">Sortie médicale prononcée le {formatDateTime(h.dischargedAt)}. Elle ne clôture pas le solde financier : la clôture administrative n&apos;est possible qu&apos;après facturation et règlement.</DemoNotice>}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "sejour", label: "Séjour" },
          { key: "plan", label: "Plan de soins", count: h.carePlan.length },
          { key: "care", label: "Soins effectués", count: h.careActs.length },
          { key: "obs", label: "Observations", count: h.observations.length },
          { key: "trn", label: "Transmissions", count: h.transmissions.length },
          { key: "rx", label: "Prescriptions", count: prescriptions.length },
          { key: "billing", label: "Préfacturation" },
          { key: "exit", label: "Sortie et suivi" },
          { key: "docs", label: "Documents" },
        ]}
      />

      {tab === "sejour" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title="Informations du séjour">
            <InfoGrid
              items={[
                { label: "Patient", value: <Link className="text-brand-600 hover:underline" href={`/patients/${h.patientId}`}>{patientName(db, h.patientId)}</Link> },
                { label: "Client payeur", value: clientName(db, h.clientId) },
                { label: "Admission", value: formatDateTime(h.admittedAt) },
                { label: "Emplacement", value: h.cage },
                { label: "Responsable", value: userName(db, h.vetId) },
                { label: "Forfait journalier", value: formatXOF(h.dailyRate) },
                { label: "Motif", value: h.reason, wide: true },
                { label: "Devis", value: quote ? `${quote.code} — ${formatXOF(docTotal(quote.lines))} (${quote.status})` : "Aucun" },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Consentement">
            {h.consent.signed ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Signé par <strong>{h.consent.signedBy}</strong> le {formatDateTime(h.consent.date)} (simulation).
              </p>
            ) : (
              <div className="space-y-3">
                <DemoNotice tone="warning">Consentement non enregistré.</DemoNotice>
                {open && editable && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <TextField label="Signataire" value={consentBy} onChange={setConsentBy} className="flex-1" />
                    <Button size="sm" onClick={() => run(setConsent, { id: h.id, signedBy: consentBy })}>
                      Enregistrer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ComponentCard>
        </div>
      )}

      {tab === "plan" && (
        <ComponentCard title="Plan de soins">
          <ul className="space-y-2">
            {h.carePlan.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
                <input type="checkbox" checked={c.done} disabled={!open || !editable} onChange={() => run(toggleCarePlan, { id: h.id, itemId: c.id }, { silent: true })} className="size-4 rounded text-brand-500" />
                <span className={c.done ? "text-gray-400 line-through" : "text-sm text-gray-800 dark:text-white/90"}>{c.label}</span>
                <span className="ms-auto text-theme-xs text-gray-500">{c.schedule}</span>
              </li>
            ))}
          </ul>
          {open && can("hospitalisation", "validate") && (
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <TextField label="Nouvel élément" value={plan.label} onChange={(x) => setPlan({ ...plan, label: x })} />
              <TextField label="Fréquence" value={plan.schedule} onChange={(x) => setPlan({ ...plan, schedule: x })} />
              <Button size="sm" onClick={() => run(addCarePlanItem, { id: h.id, ...plan }).ok && setPlan({ label: "", schedule: "" })}>
                Ajouter
              </Button>
            </div>
          )}
        </ComponentCard>
      )}

      {tab === "care" && (
        <ComponentCard title="Soins effectués" desc="Chaque soin peut consommer un produit (une seule fois) et proposer une ligne provisoire de facturation">
          {h.careActs.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun soin enregistré.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {h.careActs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <strong>{c.label}</strong>
                    {c.productId && ` · ${productName(db, c.productId)} × ${c.qty}`}
                    <span className="block text-theme-xs text-gray-500">
                      {formatDateTime(c.date)} · {userName(db, c.authorId)}
                    </span>
                  </span>
                  {c.billingLine && <span className={c.billingLine.status === "facturee" ? "text-theme-xs text-success-600" : "text-theme-xs text-warning-600"}>{c.billingLine.status === "facturee" ? "Facturée" : "Ligne provisoire"} · {formatXOF(c.billingLine.qty * c.billingLine.unitPrice)}</span>}
                </li>
              ))}
            </ul>
          )}
        </ComponentCard>
      )}

      {tab === "obs" && (
        <ComponentCard title="Observations horodatées">
          {open && (
            <div className="space-y-2">
              <TextArea value={obs} onChange={setObs} rows={2} placeholder="Nouvelle observation…" />
              <div className="flex justify-end">
                <Button size="sm" disabled={!obs.trim()} onClick={() => run(addObservation, { id: h.id, text: obs }).ok && setObs("")}>
                  Ajouter
                </Button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {h.observations.map((o) => (
              <li key={o.id} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/3">
                {o.text}
                <span className="block text-theme-xs text-gray-500">{formatDateTime(o.date)} · {userName(db, o.authorId)}</span>
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      {tab === "trn" && (
        <ComponentCard title="Transmissions entre équipes">
          {open && (
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <SelectField label="Relève" value={trn.shift} onChange={(x) => setTrn({ ...trn, shift: x })} options={["Jour → Nuit", "Nuit → Jour", "Week-end"].map((s) => ({ value: s, label: s }))} />
              <TextField label="Transmission" value={trn.text} onChange={(x) => setTrn({ ...trn, text: x })} />
              <Button size="sm" disabled={!trn.text.trim()} onClick={() => run(addTransmission, { id: h.id, ...trn }).ok && setTrn({ ...trn, text: "" })}>
                Transmettre
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {h.transmissions.map((t) => (
              <li key={t.id} className="rounded-lg border border-tertiary-100 bg-tertiary-25 p-3 text-sm dark:border-tertiary-800 dark:bg-tertiary-500/5">
                <span className="text-theme-xs font-medium text-tertiary-700 dark:text-tertiary-300">{t.shift}</span> — {t.text}
                <span className="block text-theme-xs text-gray-500">{formatDateTime(t.date)} · {userName(db, t.authorId)}</span>
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      {tab === "rx" && (
        <ComponentCard title="Prescriptions du séjour" actions={open && can("prescriptions", "create") && <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={rx.openModal}>Prescrire</Button>}>
          <PrescriptionsTable rows={prescriptions} onDeliver={setDeliver} />
        </ComponentCard>
      )}

      {tab === "billing" && (
        <ComponentCard title="Préfacturation" desc="Lignes provisoires issues du séjour et des soins — chacune n'est facturée qu'une fois">
          <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {provisional.map((l) => (
              <li key={l.id} className="flex justify-between py-2">
                <span>{l.label} × {l.qty}</span>
                <span>{formatXOF(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <p className="text-end text-sm font-semibold">{formatXOF(provisionalTotal)}</p>
          {inv && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/3">
              <span>
                Facture {inv.code} · <StatusBadge kind="invoice" value={inv.status} /> · solde {formatXOF(invoiceBalance(db, inv))}
              </span>
              {invoiceBalance(db, inv) > 0 && (inv.status !== "brouillon" && inv.status !== "a_valider") && can("finances", "create") && (
                <Button size="xs" onClick={pay.openModal}>
                  Encaisser
                </Button>
              )}
            </div>
          )}
        </ComponentCard>
      )}

      {tab === "exit" && (
        <ComponentCard title="Sortie médicale et suivi post-sortie">
          {h.status === "en_cours" ? (
            <p className="text-sm text-gray-500">Séjour en cours.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <strong>Sortie médicale :</strong> {formatDateTime(h.dischargedAt)} — {h.dischargeNotes}
              </p>
              {h.followUp && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                  <span>
                    Suivi prévu le <strong>{formatDate(h.followUp.date)}</strong> — {h.followUp.notes} {h.followUp.done && "(réalisé)"}
                  </span>
                  {!h.followUp.done && editable && (
                    <Button size="xs" variant="soft" onClick={() => run(completeFollowUp, { id: h.id, notes: "" })}>
                      Marquer réalisé
                    </Button>
                  )}
                </div>
              )}
              {h.status === "sortie_medicale" && (
                <Button size="sm" variant="outline" onClick={() => run(closeStay, { id: h.id })}>
                  Clôture administrative
                </Button>
              )}
            </div>
          )}
        </ComponentCard>
      )}

      {tab === "docs" && (
        <ComponentCard title="Documents du séjour">
          <LinkedDocuments refs={[{ kind: "hospitalisation", id: h.id }]} addTo={{ kind: "hospitalisation", id: h.id }} />
        </ComponentCard>
      )}

      <AppModal
        isOpen={careModal.isOpen}
        onClose={careModal.closeModal}
        title="Soin effectué"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={careModal.closeModal}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!care.label.trim()}
              onClick={() =>
                run(recordCareAct, {
                  id: h.id,
                  label: care.label,
                  productId: care.productId || undefined,
                  qty: care.productId ? care.qty : undefined,
                  billing: care.bill ? { label: care.billLabel || (care.productId ? productName(db, care.productId) : care.label), qty: care.productId ? care.qty : 1, unitPrice: care.price } : undefined,
                  opKey: care.opKey,
                }).ok && careModal.closeModal()
              }
            >
              Enregistrer le soin
            </Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Soin réalisé" required value={care.label} onChange={(x) => setCare({ ...care, label: x })} className="sm:col-span-2" />
          <SelectField label="Produit consommé (optionnel)" value={care.productId} onChange={(x) => setCare({ ...care, productId: x, price: db.products.find((p) => p.id === x)?.salePrice ?? care.price })} options={opts.products} allowEmpty placeholder="Aucun" />
          {care.productId && <NumberField label="Quantité" value={care.qty} onChange={(x) => setCare({ ...care, qty: x })} min={1} />}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={care.bill} onChange={(e) => setCare({ ...care, bill: e.target.checked })} className="rounded text-brand-500" /> Proposer une ligne provisoire de facturation
            </label>
          </div>
          {care.bill && (
            <>
              <TextField label="Libellé facturé" value={care.billLabel} onChange={(x) => setCare({ ...care, billLabel: x })} />
              <NumberField label="Prix unitaire" suffix="FCFA" value={care.price} onChange={(x) => setCare({ ...care, price: x })} min={0} step={500} />
            </>
          )}
        </FormGrid>
      </AppModal>

      <AppModal
        isOpen={dischargeModal.isOpen}
        onClose={dischargeModal.closeModal}
        title="Sortie médicale"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={dischargeModal.closeModal}>
              Annuler
            </Button>
            <Button size="sm" disabled={!discharge.notes.trim()} onClick={() => run(dischargePatient, { id: h.id, notes: discharge.notes, followUpDate: discharge.followUpDate || undefined, followUpNotes: discharge.followUpNotes }).ok && dischargeModal.closeModal()}>
              Prononcer la sortie
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DemoNotice tone="warning">La sortie médicale ne règle pas le solde financier : la facture et les paiements restent à traiter séparément.</DemoNotice>
          <TextAreaField label="Compte rendu de sortie" required value={discharge.notes} onChange={(x) => setDischarge({ ...discharge, notes: x })} rows={3} />
          <FormGrid>
            <TextField label="Suivi post-sortie le" type="date" value={discharge.followUpDate} onChange={(x) => setDischarge({ ...discharge, followUpDate: x })} />
            <TextField label="Objet du suivi" value={discharge.followUpNotes} onChange={(x) => setDischarge({ ...discharge, followUpNotes: x })} />
          </FormGrid>
        </div>
      </AppModal>

      <PrescriptionModal isOpen={rx.isOpen} onClose={rx.closeModal} patientId={h.patientId} hospitalizationId={h.id} />
      <DeliveryModal prescription={deliver} onClose={() => setDeliver(null)} />
      {inv && <PaymentModal isOpen={pay.isOpen} onClose={pay.closeModal} invoiceId={inv.id} />}
    </div>
  );
}
