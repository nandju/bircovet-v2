"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { HERD } from "@/lib/farmProfile";
import { uid } from "@/lib/format";
import { PROTOCOL_CATS } from "@/lib/protocols";
import { saveProtocol, type ProtocolInput } from "@/lib/services/protocolsService";
import type { ProtocolCategory } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const SPECIES = ["Chien", "Chat", "NAC", ...HERD];

/** Saisie simple : une ligne = une étape (« ! » devant = étape critique), une ligne = un lien « Nom | adresse ». */
export default function ProtocolEditor({ value, onClose }: { value: ProtocolInput | null; onClose: () => void }) {
  const { run } = useDemo();
  const router = useRouter();
  const [v, setV] = useState<ProtocolInput | null>(null);
  const [steps, setSteps] = useState("");
  const [mats, setMats] = useState("");
  const [links, setLinks] = useState("");
  useEffect(() => {
    if (!value) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialisation à l'ouverture
    setV(value);
    setSteps(value.steps.map((s) => `${s.critical ? "! " : ""}${s.text}`).join("\n"));
    setMats(value.materials.join("\n"));
    setLinks(value.links.map((l) => `${l.label} | ${l.url}`).join("\n"));
  }, [value]);
  if (!value || !v) return null;
  const save = () => {
    const input: ProtocolInput = {
      ...v,
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean).map((s) => ({ id: uid("st"), text: s.replace(/^!\s*/, ""), critical: s.startsWith("!") })),
      materials: mats.split("\n").map((s) => s.trim()).filter(Boolean),
      links: links.split("\n").map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b] = s.includes("|") ? s.split("|") : [s, s]; return { label: a.trim(), url: (b ?? a).trim() }; }),
    };
    const r = run(saveProtocol, input);
    if (r.ok) {
      onClose();
      if (!v.id && r.data) router.push(`/protocoles/${r.data}`);
    }
  };
  return (
    <AppModal isOpen onClose={onClose} size="lg" title={v.id ? "Modifier la fiche" : "Nouvelle fiche"} description="Les modifications d'un assistant repassent la fiche en brouillon jusqu'à validation par un vétérinaire." footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={save}>Enregistrer</Button></>}>
      <FormGrid>
        <TextField label="Titre" required value={v.title} onChange={(x) => setV({ ...v, title: x })} className="sm:col-span-2" />
        <SelectField label="Type de fiche" value={v.category} onChange={(x) => setV({ ...v, category: x as ProtocolCategory })} options={(Object.keys(PROTOCOL_CATS) as ProtocolCategory[]).map((k) => ({ value: k, label: PROTOCOL_CATS[k].label }))} />
        <TextField label="Pathologie / situation" value={v.subject} onChange={(x) => setV({ ...v, subject: x })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Espèces concernées</p>
          <div className="flex flex-wrap gap-1.5">
            {SPECIES.map((s) => (
              <button key={s} type="button" aria-pressed={v.species.includes(s)} onClick={() => setV({ ...v, species: v.species.includes(s) ? v.species.filter((x) => x !== s) : [...v.species, s] })} className={cn("rounded-full border px-2.5 py-0.5 text-theme-xs", v.species.includes(s) ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")}>{s}</button>
            ))}
          </div>
        </div>
        <TextAreaField label="Résumé (à retenir)" value={v.summary} onChange={(x) => setV({ ...v, summary: x })} rows={2} className="sm:col-span-2" />
        <TextAreaField label="Étapes — une par ligne (« ! » au début = étape critique)" value={steps} onChange={setSteps} rows={8} className="sm:col-span-2" />
        <TextAreaField label="Matériel à prévoir — un par ligne" value={mats} onChange={setMats} rows={3} />
        <TextAreaField label="Points de vigilance" value={v.warnings} onChange={(x) => setV({ ...v, warnings: x })} rows={3} />
        <TextAreaField label="Liens (Google Docs, Drive, vidéo…) — « Nom | https://… » par ligne" value={links} onChange={setLinks} rows={2} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}
