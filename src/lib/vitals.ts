import type { Consultation } from "./types";

type V = Pick<Consultation, "weightKg" | "temperature" | "heartRate" | "respRate" | "mucous" | "crtSec" | "dehydrationPct" | "bodyCondition" | "painScore" | "pulse" | "glycemia">;

/** Constantes sur une ligne. */
export function vitalsText(c: V) {
  return [
    c.weightKg && `${c.weightKg} kg`,
    c.temperature && `T° ${c.temperature} °C`,
    c.heartRate && `FC ${c.heartRate} bpm`,
    c.respRate && `FR ${c.respRate} mvt/min`,
    c.pulse && `pouls ${c.pulse.toLowerCase()}`,
    c.mucous && `muqueuses ${c.mucous.toLowerCase()}`,
    c.crtSec !== undefined && `TRC ${c.crtSec} s`,
    c.dehydrationPct !== undefined && `déshydratation ${c.dehydrationPct} %`,
    c.bodyCondition && `NEC ${c.bodyCondition}/9`,
    c.painScore !== undefined && `douleur ${c.painScore}/10`,
    c.glycemia && `glycémie ${c.glycemia} g/L`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Repères indicatifs (chien / chat adultes) : signalés, jamais bloquants. */
export function vitalAlerts(c: V): string[] {
  const out: string[] = [];
  if (c.temperature !== undefined && c.temperature > 39.4) out.push("hyperthermie");
  if (c.temperature !== undefined && c.temperature < 37.5) out.push("hypothermie");
  if (c.crtSec !== undefined && c.crtSec > 2) out.push("TRC allongé");
  if (c.mucous && /p[âa]les|cyanos|ict[ée]r/i.test(c.mucous)) out.push(`muqueuses ${c.mucous.toLowerCase()}`);
  if (c.dehydrationPct !== undefined && c.dehydrationPct >= 5) out.push(`déshydratation ${c.dehydrationPct} %`);
  if (c.painScore !== undefined && c.painScore >= 5) out.push("douleur marquée : prévoir l'analgésie");
  if (c.bodyCondition !== undefined && c.bodyCondition <= 3) out.push("maigreur");
  if (c.bodyCondition !== undefined && c.bodyCondition >= 7) out.push("surpoids");
  if (c.glycemia !== undefined && c.glycemia < 0.6) out.push("hypoglycémie possible");
  if (c.glycemia !== undefined && c.glycemia > 2) out.push("hyperglycémie possible");
  return out;
}
