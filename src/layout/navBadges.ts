import { casesDue } from "@/lib/care";
import { proofCount } from "@/lib/projects";
import { dueActions } from "@/lib/prophylaxis";
import type { DemoDB, User } from "@/lib/types";

/** Pastilles du menu : ce qui attend une action de l'utilisateur connecté. */
export function navBadges(db: DemoDB, user: User | null | undefined): Record<string, number> {
  if (!user) return {};
  const isDG = user.roleId === "dg";
  const out: Record<string, number> = {};
  const req = db.appointments.filter((a) => a.status === "demande" && (isDG || a.practitionerId === user.id)).length;
  if (req) out.agendaRequests = req;
  const care = ["dg", "vet", "assistant", "accueil"].includes(user.roleId) ? casesDue(db, new Date().toLocaleDateString("sv-SE")).length : 0;
  if (care) out.careFollowUp = care;
  const prophy = ["dg", "vet", "assistant"].includes(user.roleId) ? dueActions(db, new Date().toLocaleDateString("sv-SE"), 0).length : 0;
  if (prophy) out.prophylaxis = prophy;
  const myTasks = db.tasks.filter((t) => (t.category === "equipe" || t.category === "document" || t.assignedById) && ((t.assigneeId === user.id && t.status !== "termine") || (t.review?.status === "a_verifier" && (t.assignedById === user.id || isDG)))).length;
  if (myTasks) out.teamTasks = myTasks;
  const appr = (db.approvals ?? []).filter((a) => a.status === "en_attente").length;
  if (isDG && appr) out.approvals = appr;
  const noProof = db.expenses.filter((e) => e.status !== "rejetee" && proofCount(e) === 0 && (isDG || !e.confidential)).length;
  if ((isDG || user.roleId === "accueil" || user.roleId === "comptable") && noProof) out.expenses = noProof;
  return out;
}
