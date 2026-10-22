/**
 * Assistant IA — SIMULATION LOCALE. Aucun modèle d'IA réel n'est appelé :
 * les réponses sont produites par des scénarios prédéfinis à partir des données fictives.
 * L'assistant ne décide, ne valide, ne modifie et n'envoie jamais rien.
 */
import { clientName, docTotal, invoiceBalance, patientName, userName } from "../calc";
import { formatDate, formatXOF, normalize, uid } from "../format";
import type { AIMessage, DemoDB } from "../types";
import { fail, must, produce, type Service } from "./core";
import { duplicateGroups } from "./clientsService";

export const AI_DISCLAIMER = "Brouillon à vérifier";

export const AI_SUGGESTIONS = [
  { label: "Résumer une consultation", prompt: "Prépare un résumé de la consultation CONS-0003" },
  { label: "Compte rendu pour le client", prompt: "Prépare un compte rendu client pour la dernière consultation validée" },
  { label: "Rechercher un document", prompt: "Recherche les documents sur la mission" },
  { label: "Extraire les champs d'un document", prompt: "Extrais les champs du document Ordonnance ORD-0001" },
  { label: "Anomalies administratives", prompt: "Signale les anomalies administratives" },
];

const FORBIDDEN: [RegExp, string][] = [
  [/(dose|posolog|mg\/kg|combien de (ml|mg))/, "proposer une dose"],
  [/(diagnosti(c|que) (est|probable)|quel diagnostic|pose(r)? le diagnostic)/, "décider d'un diagnostic"],
  [/(prescri(s|re|ption) (moi|un|une)|quel (medicament|traitement) donner)/, "inventer une prescription"],
  [/(delivr|autorise(r)? la delivrance)/, "autoriser une délivrance"],
  [/(modifie(r)? le stock|ajuste(r)? le stock|retire(r)? du stock)/, "modifier le stock"],
  [/(valide(r)? (la|une|cette) facture)/, "valider une facture"],
  [/(accorde(r)? (un|le) credit|autorise(r)? (un|le) credit)/, "autoriser un crédit"],
  [/(envoie|envoyer|envoi) (un |le )?(sms|message|mail|e-mail|whatsapp)/, "envoyer un message au client"],
  [/(declare(r)? (le )?deces|statut vital|euthanasi)/, "modifier le statut vital d'un patient"],
];

interface AIAnswer {
  content: string;
  scenario: string;
  references: { label: string; href?: string }[];
}

export function generateAIResponse(db: DemoDB, prompt: string): AIAnswer {
  const p = normalize(prompt);
  for (const [re, what] of FORBIDDEN)
    if (re.test(p))
      return {
        scenario: "refus",
        references: [],
        content: `Je ne peux pas ${what}. Cette décision relève exclusivement d'un professionnel habilité et des validations prévues dans Cliva.\n\nJe peux en revanche : résumer un dossier fictif, préparer un brouillon de compte rendu à partir de consignes déjà validées, rechercher dans la bibliothèque documentaire ou signaler des anomalies administratives.`,
      };

  if (/anomal|incoheren|verifi/.test(p)) {
    const today = new Date().toISOString().slice(0, 10);
    const late = db.invoices.filter((i) => i.status === "en_retard");
    const pendingRec = db.receptions.filter((r) => r.status === "proposee");
    const toValidate = db.consultations.filter((c) => c.status === "a_valider");
    const noConsent = db.hospitalizations.filter((h) => h.status === "en_cours" && !h.consent.signed);
    const dups = duplicateGroups(db);
    const drafts = db.invoices.filter((i) => i.status === "brouillon" && i.date < today);
    const pendingCor = db.corrections.filter((c) => c.status === "proposee");
    const lines = [
      `• ${late.length} facture(s) en retard — solde total ${formatXOF(late.reduce((s, i) => s + invoiceBalance(db, i), 0))}.`,
      `• ${pendingRec.length} réception(s) fournisseur proposée(s) non validée(s)${pendingRec.length ? ` (${pendingRec.map((r) => r.code).join(", ")})` : ""}.`,
      `• ${toValidate.length} consultation(s) en attente de validation clinique${toValidate.length ? ` (${toValidate.map((c) => c.code).join(", ")})` : ""}.`,
      `• ${noConsent.length} séjour(s) d'hospitalisation sans consentement enregistré${noConsent.length ? ` (${noConsent.map((h) => h.code).join(", ")})` : ""}.`,
      `• ${dups.length} groupe(s) de doublons clients potentiels${dups.length ? ` (${dups.map((g) => g.map((c) => c.code).join(" / ")).join(" ; ")})` : ""}.`,
      `• ${drafts.length} facture(s) brouillon antérieure(s) à aujourd'hui.`,
      `• ${pendingCor.length} correction(s) de stock en attente de décision DG.`,
    ];
    return {
      scenario: "anomalies",
      content: `Analyse administrative des données fictives :\n\n${lines.join("\n")}\n\nAucune correction n'a été appliquée : chaque point doit être traité dans son module.`,
      references: [
        { label: "Factures", href: "/facturation" },
        { label: "Réceptions", href: "/achats/receptions" },
        { label: "Consultations", href: "/consultations" },
        { label: "Fusion de clients", href: "/clients/fusion" },
      ],
    };
  }

  const codeMatch = prompt.match(/CONS-\d{4}/i);
  if (/resum/.test(p) && /consult/.test(p)) {
    const c = codeMatch ? db.consultations.find((x) => x.code.toLowerCase() === codeMatch[0].toLowerCase()) : db.consultations.find((x) => x.status === "valide");
    if (!c) return { scenario: "resume", references: [], content: "Consultation introuvable dans les données fictives. Précisez un code (ex. CONS-0003)." };
    return {
      scenario: "resume",
      references: [{ label: `${c.code} — ${patientName(db, c.patientId)}`, href: `/consultations/${c.id}` }],
      content: [
        `Résumé de ${c.code} (${formatDate(c.date)}) — patient ${patientName(db, c.patientId)}, client ${clientName(db, c.clientId)}.`,
        `Motif : ${c.reason}.`,
        `Anamnèse : ${c.anamnesis || "non renseignée"}.`,
        `Examen : ${c.exam || "non renseigné"}.`,
        `Diagnostic saisi par le vétérinaire : ${c.diagnosis || "non renseigné"}.`,
        `Plan de soins saisi : ${c.carePlan || "non renseigné"}.`,
        `Statut clinique : ${c.status === "valide" ? `validé par ${userName(db, c.validatedById)}` : "NON validé"}. Responsable : ${userName(db, c.vetId)} ; saisie : ${userName(db, c.authorId)}.`,
      ].join("\n"),
    };
  }

  if (/compte rendu|cr client|pour le client/.test(p)) {
    const c = (codeMatch ? db.consultations.find((x) => x.code.toLowerCase() === codeMatch[0].toLowerCase()) : undefined) ?? db.consultations.find((x) => x.status === "valide");
    if (!c) return { scenario: "cr", references: [], content: "Aucune consultation trouvée." };
    if (c.status !== "valide")
      return { scenario: "cr", references: [{ label: c.code, href: `/consultations/${c.id}` }], content: `La consultation ${c.code} n'est pas validée : un compte rendu client ne peut être préparé qu'à partir de consignes déjà validées par le vétérinaire.` };
    return {
      scenario: "cr",
      references: [{ label: c.code, href: `/consultations/${c.id}` }],
      content: `Madame, Monsieur ${clientName(db, c.clientId)},\n\nSuite à la consultation de ${patientName(db, c.patientId)} du ${formatDate(c.date)} pour « ${c.reason} », voici les consignes validées par ${userName(db, c.vetId)} :\n\n${c.carePlan}\n${c.followUpDate ? `\nUn contrôle est recommandé autour du ${formatDate(c.followUpDate)}.` : ""}\n\nN'hésitez pas à contacter la clinique pour toute question.\nL'équipe Cliva\n\n(Texte reformulé à partir des consignes validées — aucune information clinique ajoutée.)`,
    };
  }

  if (/extrai|champs/.test(p)) {
    const words = p.split(/\s+/).filter((w) => w.length > 3);
    const doc = db.documents.find((d) => words.some((w) => normalize(d.title).includes(w) && !["extrais", "champs", "document"].includes(w))) ?? db.documents[0];
    const fields = (doc.contentText ?? "")
      .split("\n")
      .filter((l) => l.includes(":"))
      .map((l) => `• ${l.split(":")[0].trim()} → ${l.split(":").slice(1).join(":").trim()}`);
    return {
      scenario: "extraction",
      references: [{ label: doc.title, href: "/documents" }],
      content: `Champs extraits du document « ${doc.title} » (v${doc.version}, ${formatDate(doc.date)}) :\n\n${fields.length ? fields.join("\n") : "• Aucun champ structuré détecté."}\n• Catégorie → ${doc.category}\n• Auteur → ${userName(db, doc.authorId)}`,
    };
  }

  if (/recherch|trouve|document/.test(p)) {
    const terms = p.split(/\s+/).filter((w) => w.length > 3 && !["recherche", "documents", "document", "les", "sur", "dans"].includes(w));
    const hits = db.documents.filter((d) => d.status === "actif" && terms.some((t) => normalize(`${d.title} ${d.contentText ?? ""} ${d.category}`).includes(t)));
    return {
      scenario: "recherche",
      references: hits.slice(0, 6).map((d) => ({ label: d.title, href: "/documents" })),
      content: hits.length ? `${hits.length} document(s) fictif(s) trouvé(s) :\n\n${hits.slice(0, 6).map((d) => `• ${d.title} — ${formatDate(d.date)} (${d.category})`).join("\n")}` : `Aucun document ne correspond à « ${terms.join(" ")} ».`,
    };
  }

  if (/factur|impaye|solde/.test(p)) {
    const late = db.invoices.filter((i) => i.status === "en_retard").slice(0, 5);
    return {
      scenario: "factures",
      references: late.map((i) => ({ label: i.code, href: `/facturation/factures/${i.id}` })),
      content: `Factures en retard (extrait, données fictives) :\n\n${late.map((i) => `• ${i.code} — ${clientName(db, i.clientId)} — total ${formatXOF(docTotal(i.lines))}, solde ${formatXOF(invoiceBalance(db, i))}`).join("\n") || "Aucune."}\n\nLa relance éventuelle doit être préparée dans « Relation client » (envoi simulé).`,
    };
  }

  return {
    scenario: "aide",
    references: [],
    content: "Je suis un assistant SIMULÉ (aucun modèle d'IA réel). Je peux :\n• résumer une consultation fictive (ex. « résume CONS-0003 ») ;\n• préparer un compte rendu client à partir de consignes validées ;\n• rechercher dans la bibliothèque documentaire ;\n• extraire les champs d'un document de démonstration ;\n• signaler des anomalies administratives.",
  };
}

export const askAssistant: Service<{ conversationId?: string; prompt: string }, string> = (db, ctx, { conversationId, prompt }) =>
  produce(db, (d) => {
    if (!prompt.trim()) fail("Saisissez une demande.");
    let conv = conversationId ? d.aiConversations.find((c) => c.id === conversationId) : undefined;
    if (!conv) {
      conv = { id: uid("ai"), title: prompt.slice(0, 60), date: ctx.now, messages: [] };
      d.aiConversations.unshift(conv);
    }
    const ans = generateAIResponse(d, prompt);
    const user: AIMessage = { id: uid("aim"), role: "user", content: prompt, date: ctx.now };
    const bot: AIMessage = { id: uid("aim"), role: "assistant", content: ans.content, date: ctx.now, scenario: ans.scenario, references: ans.references, draftStatus: ans.scenario === "refus" || ans.scenario === "aide" ? undefined : "brouillon" };
    conv.messages.push(user, bot);
    return { data: conv.id };
  });

export const setDraftStatus: Service<{ conversationId: string; messageId: string; status: NonNullable<AIMessage["draftStatus"]>; content?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const conv = must(d.aiConversations.find((c) => c.id === input.conversationId));
    const m = must(conv.messages.find((x) => x.id === input.messageId));
    if (input.content !== undefined) m.content = input.content;
    m.draftStatus = input.status;
    return {
      message:
        input.status === "accepte"
          ? "Brouillon accepté comme texte de travail. Aucune action clinique ou financière n'a été exécutée ; les validations habituelles restent obligatoires."
          : input.status === "rejete"
            ? "Brouillon rejeté."
            : "Brouillon modifié.",
    };
  });

export const deleteConversation: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    d.aiConversations = d.aiConversations.filter((c) => c.id !== id);
    return { message: "Conversation supprimée." };
  });
