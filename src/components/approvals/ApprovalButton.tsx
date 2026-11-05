"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { APPROVAL_STATUS, requestApproval, type ApprovalInput } from "@/lib/services/approvalsService";
import { cn } from "@/utils";
import { useState } from "react";

/**
 * « Demander l'aval du directeur » sur n'importe quel élément (rapport, action, facture…).
 * Le DG reçoit une notification push ; l'état de la demande s'affiche à côté du bouton.
 */
export default function ApprovalButton({ refKind, refId, link, title = "", detail = "", size = "sm", label = "Demander l'aval du DG", amount }: { refKind: ApprovalInput["refKind"]; refId?: string; link?: string; title?: string; detail?: string; size?: "xs" | "sm"; label?: string; amount?: number }) {
  const { db, run, user } = useDemo();
  const [v, setV] = useState<ApprovalInput | null>(null);
  if (!user || user.roleId === "dg") {
    const pending = (db.approvals ?? []).filter((a) => a.refId && a.refId === refId && a.status === "en_attente");
    return pending.length ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", APPROVAL_STATUS.en_attente.chip)}>{pending.length} aval(s) à donner</span> : null;
  }
  const last = (db.approvals ?? []).find((a) => a.refId && a.refId === refId);
  return (
    <>
      {last && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", APPROVAL_STATUS[last.status].chip)} title={last.decisionNote}>{APPROVAL_STATUS[last.status].label}</span>}
      <Button size={size} variant="outline" onClick={() => setV({ refKind, refId, link, title, detail, amount, urgency: "normale" })}>{label}</Button>
      <AppModal
        isOpen={!!v}
        onClose={() => setV(null)}
        title="Demander l'aval du directeur"
        description="Le directeur reçoit une notification immédiate et vous répond ici."
        footer={<><Button size="sm" variant="outline" onClick={() => setV(null)}>Annuler</Button><Button size="sm" onClick={() => v && run(requestApproval, v).ok && setV(null)}>Envoyer</Button></>}
      >
        {v && (
          <FormGrid>
            <TextField label="Décision à valider" required value={v.title} onChange={(x) => setV({ ...v, title: x })} className="sm:col-span-2" placeholder="Ex. : abattage sanitaire du lot B, remise de 15 %…" />
            <TextAreaField label="Contexte et proposition" value={v.detail} onChange={(x) => setV({ ...v, detail: x })} rows={4} className="sm:col-span-2" />
            <SelectField label="Urgence" value={v.urgency} onChange={(x) => setV({ ...v, urgency: x as ApprovalInput["urgency"] })} options={[{ value: "normale", label: "Normale" }, { value: "urgente", label: "Urgente (réponse rapide)" }]} />
            <NumberField label="Montant concerné (FCFA, facultatif)" value={v.amount ?? NaN} onChange={(x) => setV({ ...v, amount: Number.isFinite(x) ? x : undefined })} min={0} />
          </FormGrid>
        )}
      </AppModal>
    </>
  );
}
