"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import LinkedDocuments from "@/components/documents/LinkedDocuments";
import { CheckField, NumberField, SelectField, TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link, useRouter } from "@/i18n/navigation";
import { clientName, lotBlockReason, lotRef, productName, userName } from "@/lib/calc";
import { formatDate, formatDateTime, uid } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { invoiceMission, missionTransitions, reconcileMission, recordMissionUsage, saveMissionReport, setMissionStatus, transferToMission } from "@/lib/services/missionsService";
import type { MissionStatus } from "@/lib/types";
import { useEffect, useState } from "react";
import MissionFormModal from "./MissionFormModal";

export default function MissionDetail({ id }: { id: string }) {
  const { db, run, today, can, session } = useDemo();
  const router = useRouter();
  const m = db.missions.find((x) => x.id === id);
  const [tab, setTab] = useState("general");
  const edit = useModal();
  const [cancel, setCancel] = useState(false);
  const [tr, setTr] = useState({ lotId: "", qty: 1 });
  const [usage, setUsage] = useState<Record<string, { consumed: number; delivered: number; lost: number; returned: number }>>({});
  const [report, setReport] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [observed, setObserved] = useState<{ farmId: string; lotLabel: string; count: number }[]>([]);
  const [inv, setInv] = useState({ clientId: "", amount: 85000 });
  useEffect(() => {
    if (!m) return;
    setReport(m.report);
    setDone(m.interventionsDone);
    setObserved(m.observedHeadcounts.length ? m.observedHeadcounts : m.farmIds.map((f) => ({ farmId: f, lotLabel: db.farms.find((x) => x.id === f)?.lots[0]?.name ?? "", count: 0 })));
    setUsage(Object.fromEntries(m.stock.map((s) => [s.id, { consumed: s.consumed, delivered: s.delivered, lost: s.lost, returned: s.returned }])));
    setInv({ clientId: m.clientIds[0] ?? "", amount: 85000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, m?.stock.length, m?.status]);
  if (!m) return <p className="text-sm text-gray-500">Mission introuvable.</p>;
  const editable = can("missions", "update") && m.status !== "terminee" && m.status !== "annulee";
  const lots = db.lots.filter((l) => l.establishmentId === m.establishmentId && !lotBlockReason(l, today));
  const go = (s: MissionStatus) => (s === "annulee" ? setCancel(true) : run(setMissionStatus, { id: m.id, status: s }));
  const STATUS_BTN: Record<MissionStatus, string> = { planifiee: "Planifier", en_cours: "Démarrer", terminee: "Terminer", annulee: "Annuler", brouillon: "Repasser en brouillon" };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`${m.code} — ${m.objective}`}
        subtitle={`${formatDate(m.date)}${m.endDate !== m.date ? ` → ${formatDate(m.endDate)}` : ""} · ${m.location}`}
        trail={[{ label: "Missions", href: "/missions" }]}
        actions={
          <>
            <StatusBadge kind="mission" value={m.status} size="md" />
            {editable && <Button size="sm" variant="outline" onClick={edit.openModal}>Modifier</Button>}
            {can("missions", "update") &&
              missionTransitions(m.status).map((s) => (
                <Button key={s} size="sm" variant={s === "annulee" ? "ghost" : s === "brouillon" ? "outline" : "primary"} className={s === "annulee" ? "text-error-600" : ""} onClick={() => go(s)}>
                  {STATUS_BTN[s]}
                </Button>
              ))}
          </>
        }
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Vue générale" },
          { key: "stock", label: "Préparation et stock", count: m.stock.length },
          { key: "report", label: "Rapport et interventions" },
          { key: "reco", label: "Rapprochement" },
          { key: "billing", label: "Facturation" },
          { key: "docs", label: "Documents" },
        ]}
      />

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title="Mission">
            <InfoGrid
              items={[
                { label: "Référence", value: m.code },
                { label: "Statut", value: <StatusBadge kind="mission" value={m.status} /> },
                { label: "Responsable", value: userName(db, m.leaderId) },
                { label: "Équipe", value: m.teamIds.map((t) => userName(db, t)).join(", ") || "—" },
                { label: "Exploitations", value: m.farmIds.map((f) => <Link key={f} href={`/exploitations/${f}`} className="me-2 text-brand-600 hover:underline">{db.farms.find((x) => x.id === f)?.name}</Link>), wide: true },
                { label: "Clients", value: m.clientIds.map((c) => clientName(db, c)).join(", "), wide: true },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Interventions prévues">
            <ul className="space-y-1 text-sm">
              {m.plannedInterventions.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${m.interventionsDone.includes(p) ? "bg-success-500" : "bg-gray-300"}`} />
                  {p} {m.interventionsDone.includes(p) && <span className="text-theme-xs text-success-600">(réalisée)</span>}
                </li>
              ))}
              {!m.plannedInterventions.length && <li className="text-gray-500">Aucune intervention planifiée.</li>}
            </ul>
          </ComponentCard>
        </div>
      )}

      {tab === "stock" && (
        <ComponentCard title="Stock transféré par lot" desc="Le transfert vers une mission n'est pas une vente : il sort le stock du dépôt et sera rapproché au retour">
          {(m.status === "planifiee" || m.status === "en_cours") && can("missions", "update") && (
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <SelectField label="Lot (utilisable)" value={tr.lotId} onChange={(lotId) => setTr({ ...tr, lotId })} options={lots.map((l) => ({ value: l.id, label: `${productName(db, l.productId)} — ${l.ref} (dispo ${l.qtyAvailable}, pér. ${formatDate(l.expiryDate)})` }))} />
              <NumberField label="Quantité" value={tr.qty} onChange={(qty) => setTr({ ...tr, qty })} min={1} />
              <Button size="sm" disabled={!tr.lotId || !(tr.qty > 0)} onClick={() => run(transferToMission, { id: m.id, lotId: tr.lotId, qty: tr.qty, opKey: uid("mt") }).ok && setTr({ lotId: "", qty: 1 })}>Transférer</Button>
            </div>
          )}
          {m.status === "brouillon" && <DemoNotice>Planifiez la mission pour préparer le stock.</DemoNotice>}
          <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {m.stock.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{productName(db, s.productId)} — lot {lotRef(db, s.lotId)}</span>
                <span>Transféré : <strong>{s.transferred}</strong> {s.reconciled && <span className="ms-2 text-theme-xs text-success-600">Rapproché</span>}</span>
              </li>
            ))}
            {!m.stock.length && <li className="py-2 text-gray-500">Aucun stock transféré.</li>}
          </ul>
        </ComponentCard>
      )}

      {tab === "report" && (
        <ComponentCard title="Rapport de mission" desc="Saisie possible en mode hors ligne simulé : le rapport sera marqué « en attente de synchronisation »" actions={m.reportSyncStatus && m.reportSyncStatus !== "synchronise" && <StatusBadge kind="sync" value={m.reportSyncStatus} />}>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Interventions réalisées</p>
            {m.plannedInterventions.map((p) => (
              <CheckField key={p} label={p} checked={done.includes(p)} onChange={(x) => setDone(x ? [...done, p] : done.filter((d) => d !== p))} disabled={m.status === "annulee"} />
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Effectifs observés</p>
            {observed.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem] items-end gap-2">
                <p className="pb-3 text-sm">{db.farms.find((f) => f.id === o.farmId)?.name} — {o.lotLabel}</p>
                <NumberField label="Effectif" value={o.count} onChange={(x) => setObserved(observed.map((y, j) => (j === i ? { ...y, count: x || 0 } : y)))} min={0} />
              </div>
            ))}
          </div>
          <TextAreaField label="Rapport (fictif)" value={report} onChange={setReport} rows={5} />
          <div className="flex justify-end">
            <Button size="sm" disabled={m.status === "annulee" || !can("missions", "update")} onClick={() => run(saveMissionReport, { id: m.id, report, interventionsDone: done, observed })}>
              Enregistrer le rapport{session.offline ? " (hors ligne)" : ""}
            </Button>
          </div>
        </ComponentCard>
      )}

      {tab === "reco" && (
        <ComponentCard title="Rapprochement après mission" desc="Consommé + délivré + perdu + retourné doit égaler le transféré. Seuls les retours réintègrent le stock, une seule fois.">
          {m.stock.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun stock à rapprocher.</p>
          ) : (
            m.stock.map((s) => {
              const u = usage[s.id] ?? { consumed: 0, delivered: 0, lost: 0, returned: 0 };
              const sum = u.consumed + u.delivered + u.lost + u.returned;
              const set = (k: keyof typeof u) => (x: number) => setUsage({ ...usage, [s.id]: { ...u, [k]: x || 0 } });
              return (
                <div key={s.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                  <p className="mb-2 flex flex-wrap justify-between gap-2 text-sm font-medium">
                    <span>{productName(db, s.productId)} — {lotRef(db, s.lotId)} · transféré {s.transferred}</span>
                    <span className={sum === s.transferred ? "text-success-600" : "text-warning-600"}>{s.reconciled ? "Rapproché" : `Écart : ${s.transferred - sum}`}</span>
                  </p>
                  <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                    <NumberField label="Consommé" value={u.consumed} onChange={set("consumed")} min={0} disabled={s.reconciled} />
                    <NumberField label="Délivré (facturable)" value={u.delivered} onChange={set("delivered")} min={0} disabled={s.reconciled} />
                    <NumberField label="Perdu" value={u.lost} onChange={set("lost")} min={0} disabled={s.reconciled} />
                    <NumberField label="Retourné" value={u.returned} onChange={set("returned")} min={0} disabled={s.reconciled} />
                    {!s.reconciled && <Button size="sm" variant="outline" className="mb-0.5" onClick={() => run(recordMissionUsage, { id: m.id, lineId: s.id, ...u })}>Enregistrer</Button>}
                  </div>
                </div>
              );
            })
          )}
          {m.stock.some((s) => !s.reconciled) && can("missions", "update") && (
            <div className="flex justify-end">
              <Button onClick={() => run(reconcileMission, { id: m.id })}>Valider le rapprochement</Button>
            </div>
          )}
          {m.reconciledAt && <p className="text-theme-xs text-gray-500">Rapprochement effectué le {formatDateTime(m.reconciledAt)}.</p>}
        </ComponentCard>
      )}

      {tab === "billing" && (
        <ComponentCard title="Facturation de la mission" desc="Facture l'intervention et les seuls produits délivrés (jamais les transferts)">
          {m.status !== "terminee" ? (
            <p className="text-sm text-gray-500">Disponible une fois la mission terminée.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <SelectField label="Client facturé" value={inv.clientId} onChange={(clientId) => setInv({ ...inv, clientId })} options={m.clientIds.map((c) => ({ value: c, label: clientName(db, c) }))} />
                <NumberField label="Montant de l'intervention" suffix="F" value={inv.amount} onChange={(amount) => setInv({ ...inv, amount })} min={0} step={5000} />
                <Button size="sm" disabled={!inv.clientId || !can("facturation", "create")} onClick={() => { const r = run(invoiceMission, { id: m.id, clientId: inv.clientId, serviceAmount: inv.amount }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>Créer la facture</Button>
              </div>
              {db.invoices.filter((i) => i.lines.some((l) => l.source?.kind === "mission" && l.source.id === m.id)).map((i) => (
                <Link key={i.id} href={`/facturation/factures/${i.id}`} className="block text-sm text-brand-600 hover:underline">{i.code} — {labelOf("invoice", i.status)}</Link>
              ))}
            </>
          )}
        </ComponentCard>
      )}

      {tab === "docs" && (
        <ComponentCard title="Documents de mission">
          <LinkedDocuments refs={[{ kind: "mission", id: m.id }]} addTo={{ kind: "mission", id: m.id }} />
        </ComponentCard>
      )}

      <MissionFormModal isOpen={edit.isOpen} onClose={edit.closeModal} mission={m} />
      <ConfirmDialog isOpen={cancel} onClose={() => setCancel(false)} title="Annuler la mission" tone="danger" message="Le stock transféré doit avoir été rapproché (retours) avant annulation." reasonLabel="Motif" onConfirm={(reason) => run(setMissionStatus, { id: m.id, status: "annulee", reason }).ok} />
    </div>
  );
}
