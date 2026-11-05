import { RENTE_SPECIES } from "./followup";
import type { DemoDB, Invoice, InvoiceLine } from "./types";

/** Clientèle d'une ligne : rente si l'animal soigné est de rente, ou si le client est éleveur sans animal de compagnie. */
export function clienteleOf(db: DemoDB, inv: Invoice, l: InvoiceLine): "compagnie" | "rente" {
  if (l.source?.kind === "mission") return "rente";
  const pid =
    l.source?.kind === "consultation" ? db.consultations.find((c) => c.id === l.source?.id)?.patientId : l.source?.kind === "hospitalisation" ? db.hospitalizations.find((h) => h.id === l.source?.id)?.patientId : undefined;
  const p = pid ? db.patients.find((x) => x.id === pid) : undefined;
  if (p) return RENTE_SPECIES.includes(p.species) ? "rente" : "compagnie";
  const c = db.clients.find((x) => x.id === inv.clientId);
  if (!c) return "compagnie";
  const pets = db.patients.some((x) => x.ownerId === c.id && !RENTE_SPECIES.includes(x.species));
  const farm = c.segment === "eleveur" || db.farms.some((f) => f.clientId === c.id);
  return farm && !pets ? "rente" : "compagnie";
}
