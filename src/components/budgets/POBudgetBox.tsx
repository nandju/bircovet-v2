"use client";

import ApprovalButton from "@/components/approvals/ApprovalButton";
import { useDemo } from "@/context/DemoStoreContext";
import { activeLines, approvedFor, findLine, poBudgetCheck } from "@/lib/budgets";
import { formatXOF } from "@/lib/format";
import { setPOBudgetLine } from "@/lib/services/budgetsService";
import type { PurchaseOrder } from "@/lib/types";
import { cn } from "@/utils";

/** Imputation budgétaire d'une commande et contrôle avant envoi. */
export default function POBudgetBox({ po }: { po: PurchaseOrder }) {
  const { db, run, user } = useDemo();
  const chk = poBudgetCheck(db, po);
  const f = findLine(db, po.budgetLineId);
  const lines = activeLines(db, po.date, po.establishmentId);
  const approved = approvedFor(db, po.id);
  const ok = chk.ok || approved || user?.roleId === "dg";
  return (
    <div className={cn("rounded-3xl border p-4", ok ? "border-success-200 bg-success-25 dark:border-success-500/20 dark:bg-success-500/5" : "border-warning-200 bg-warning-25 dark:border-warning-500/20 dark:bg-warning-500/5")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Budget</p>
          <p className="text-theme-xs text-gray-600 dark:text-gray-400">
            {f ? `${f.budget.title} · ${f.line.label}` : "Aucune ligne imputée"} · commande {formatXOF(chk.total)}
            {chk.left !== undefined && ` · reste ${formatXOF(chk.left)}`}
          </p>
          <p className={cn("mt-0.5 text-theme-xs font-medium", ok ? "text-success-700 dark:text-success-400" : "text-warning-700 dark:text-warning-400")}>
            {chk.ok ? "Dans le budget : la commande peut être envoyée." : approved ? "Aval du DG obtenu : la commande peut être envoyée." : user?.roleId === "dg" ? `${chk.reason} (vous êtes DG : envoi possible)` : `${chk.reason} Aval du DG nécessaire.`}
          </p>
        </div>
        {po.status === "brouillon" && (
          <select aria-label="Ligne de budget" value={po.budgetLineId ?? ""} onChange={(e) => run(setPOBudgetLine, { poId: po.id, lineId: e.target.value }, { silent: true })} className="h-9 max-w-72 rounded-full border border-gray-200 bg-white px-3 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
            <option value="">— Imputer sur une ligne de budget —</option>
            {lines.map((x) => <option key={x.line.id} value={x.line.id}>{x.line.label} (reste {x.left.toLocaleString("fr-FR")})</option>)}
          </select>
        )}
        {!ok && po.status === "brouillon" && <ApprovalButton refKind="commande" refId={po.id} link={`/achats/commandes/${po.id}`} title={`Commande ${po.code} hors budget`} detail={`${chk.reason} Montant : ${chk.total.toLocaleString("fr-FR")} FCFA.`} amount={chk.total} />}
      </div>
    </div>
  );
}
