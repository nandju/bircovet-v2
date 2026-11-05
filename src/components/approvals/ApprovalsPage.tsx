"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, usePathname } from "@/i18n/navigation";
import { userName } from "@/lib/calc";
import { formatDateTime, formatXOF } from "@/lib/format";
import { answerApproval, APPROVAL_STATUS, decideApproval } from "@/lib/services/approvalsService";
import type { ApprovalRequest } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import ApprovalButton from "./ApprovalButton";

export function ApprovalItem({ a, compact = false }: { a: ApprovalRequest; compact?: boolean }) {
  const { db, run, user } = useDemo();
  const [dec, setDec] = useState<{ d: "approuvee" | "refusee" | "info_demandee"; note: string } | null>(null);
  const [ans, setAns] = useState<string | null>(null);
  const canDecide = user?.roleId === "dg" && ["en_attente", "info_demandee"].includes(a.status);
  return (
    <li className={cn("cliva-rise rounded-xl border p-3", a.urgency === "urgente" && a.status === "en_attente" ? "border-error-200 bg-error-25 dark:border-error-500/30 dark:bg-error-500/5" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">{a.code} · {userName(db, a.requestedById)} · {formatDateTime(a.requestedAt)}{a.urgency === "urgente" ? " · URGENT" : ""}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.link ? <Link href={a.link} className="hover:underline">{a.title}</Link> : a.title}</p>
          {!compact && <p className="mt-0.5 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{a.detail}</p>}
          {a.amount ? <p className="text-theme-xs text-gray-600 dark:text-gray-400">Montant : {formatXOF(a.amount)}</p> : null}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", APPROVAL_STATUS[a.status].chip)}>{APPROVAL_STATUS[a.status].label}</span>
      </div>
      {!compact && a.history.length > 1 && (
        <ol className="mt-2 space-y-0.5 border-s-2 border-gray-100 ps-3 text-theme-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
          {a.history.slice(1).map((h, i) => <li key={i}><strong>{userName(db, h.userId)}</strong> · {formatDateTime(h.date)} — {h.text}</li>)}
        </ol>
      )}
      {(canDecide || (a.status === "info_demandee" && a.requestedById === user?.id)) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {canDecide && <Button size="xs" onClick={() => setDec({ d: "approuvee", note: "" })}>Donner l&apos;aval</Button>}
          {canDecide && <Button size="xs" variant="outline" onClick={() => setDec({ d: "info_demandee", note: "" })}>Demander des précisions</Button>}
          {canDecide && <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setDec({ d: "refusee", note: "" })}>Refuser</Button>}
          {a.status === "info_demandee" && a.requestedById === user?.id && <Button size="xs" variant="soft" onClick={() => setAns("")}>Répondre</Button>}
        </div>
      )}
      <AppModal isOpen={!!dec} onClose={() => setDec(null)} title={dec ? APPROVAL_STATUS[dec.d].label : ""} description={a.title} footer={<><Button size="sm" variant="outline" onClick={() => setDec(null)}>Annuler</Button><Button size="sm" variant={dec?.d === "refusee" ? "danger" : "primary"} onClick={() => dec && run(decideApproval, { id: a.id, decision: dec.d, note: dec.note }).ok && setDec(null)}>Confirmer</Button></>}>
        {dec && <TextAreaField label={dec.d === "approuvee" ? "Consigne (facultatif)" : "Commentaire"} value={dec.note} onChange={(x) => setDec({ ...dec, note: x })} rows={3} />}
      </AppModal>
      <AppModal isOpen={ans !== null} onClose={() => setAns(null)} title="Compléter la demande" footer={<><Button size="sm" variant="outline" onClick={() => setAns(null)}>Annuler</Button><Button size="sm" onClick={() => ans !== null && run(answerApproval, { id: a.id, text: ans }).ok && setAns(null)}>Envoyer</Button></>}>
        <TextAreaField label="Précisions" value={ans ?? ""} onChange={setAns} rows={3} />
      </AppModal>
    </li>
  );
}

export default function ApprovalsPage() {
  const { db, user } = useDemo();
  const path = usePathname();
  const [tab, setTab] = useState("attente");
  const isDG = user?.roleId === "dg";
  const all = (db.approvals ?? []).filter((a) => isDG || a.requestedById === user?.id);
  const list = all.filter((a) => (tab === "attente" ? ["en_attente", "info_demandee"].includes(a.status) : !["en_attente", "info_demandee"].includes(a.status)));
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Avals du directeur" subtitle={isDG ? "Décisions que vos collaborateurs soumettent à votre validation" : "Vos demandes de validation au directeur"} actions={!isDG && <ApprovalButton refKind="autre" link={path} label="Nouvelle demande" />} />
      <Tabs active={tab} onChange={setTab} tabs={[{ key: "attente", label: "En attente", count: all.filter((a) => ["en_attente", "info_demandee"].includes(a.status)).length }, { key: "traitees", label: "Traitées", count: all.filter((a) => !["en_attente", "info_demandee"].includes(a.status)).length }]} />
      <ul className="space-y-3">{list.map((a) => <ApprovalItem key={a.id} a={a} />)}</ul>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune demande.</p>}
    </div>
  );
}
