import { accountBalance } from "../calc";
import { uid } from "../format";
import { audit, fail, must, nextCode, notify, positive, produce, requireOnline, requireRole, today, type Service } from "./core";

/** Dépense : approuvée d'office si dans la délégation, sinon circuit de validation DG. */
export const createExpense: Service<{ accountId: string; category: string; label: string; amount: number; date: string; attachmentName?: string; attachmentDataUrl?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "saisie de dépense");
    positive(input.amount, "Le montant");
    if (!input.label.trim()) fail("Libellé requis.");
    must(d.accounts.find((a) => a.id === input.accountId), "Compte requis.");
    const within = input.amount <= d.settings.expenseDelegationAmount;
    const auto = within || ctx.user.roleId === "dg";
    if (auto && accountBalance(d, input.accountId) < input.amount) fail("Solde du compte insuffisant (simulation).");
    const code = nextCode(d, "expense", "DEP");
    d.expenses.unshift({
      id: uid("exp"),
      code,
      date: input.date || today(ctx),
      accountId: input.accountId,
      category: input.category,
      label: input.label,
      amount: input.amount,
      status: auto ? "approuvee" : "en_attente",
      requestedById: ctx.user.id,
      decidedById: auto ? ctx.user.id : undefined,
      decidedAt: auto ? ctx.now : undefined,
      withinDelegation: within,
      confidential: input.category === "Salaires",
      attachmentName: input.attachmentName,
      attachmentDataUrl: input.attachmentDataUrl,
    });
    if (!auto) notify(d, ctx, { title: "Dépense hors délégation", body: `${code} — ${input.label} (${input.amount} F) attend une validation DG.`, level: "info", link: "/finances/depenses" });
    audit(d, ctx, { module: "Finances", action: "Saisie de dépense", target: code, newValue: String(input.amount), decision: auto ? "Dans la délégation" : "Hors délégation — en attente DG" });
    return { message: auto ? `Dépense ${code} enregistrée.` : `Dépense ${code} hors délégation : soumise à la validation du DG.` };
  });

export const decideExpense: Service<{ id: string; approve: boolean; note: string }> = (db, ctx, { id, approve, note }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "validation de dépense");
    requireOnline(ctx, "Décision financière");
    const e = must(d.expenses.find((x) => x.id === id));
    if (e.status !== "en_attente") fail("Déjà traitée.");
    if (approve && accountBalance(d, e.accountId) < e.amount) fail("Solde du compte insuffisant (simulation).");
    e.status = approve ? "approuvee" : "rejetee";
    e.decidedById = ctx.user.id;
    e.decidedAt = ctx.now;
    audit(d, ctx, { module: "Finances", action: "Décision sur dépense", target: e.code, reason: note, decision: approve ? "Approuvée" : "Rejetée" });
    return { message: approve ? "Dépense approuvée." : "Dépense rejetée." };
  });

/** Transfert entre comptes : ni recette ni charge pour son montant principal (seuls les frais sont une charge). */
export const createAccountTransfer: Service<{ fromAccountId: string; toAccountId: string; amount: number; fees: number; note: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "transfert entre comptes");
    positive(input.amount, "Le montant");
    if (input.fromAccountId === input.toAccountId) fail("Comptes source et destination identiques.");
    if (input.fees < 0) fail("Frais invalides.");
    if (accountBalance(d, input.fromAccountId) < input.amount + input.fees) fail("Solde insuffisant sur le compte source (simulation).");
    const code = nextCode(d, "transfer", "VIR");
    d.accountTransfers.unshift({ id: uid("trf"), code, date: today(ctx), ...input, userId: ctx.user.id });
    audit(d, ctx, { module: "Finances", action: "Transfert entre comptes", target: code, newValue: `${input.amount} (+ frais ${input.fees})` });
    return { message: `Transfert ${code} enregistré (simulation, non comptabilisé comme recette ni dépense).` };
  });

export const closeCash: Service<{ accountId: string; counted: number; note: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "clôture de caisse");
    const acc = must(d.accounts.find((a) => a.id === input.accountId));
    if (acc.type !== "caisse") fail("La clôture concerne une caisse.");
    if (input.counted < 0) fail("Montant compté invalide.");
    if (d.closings.some((c) => c.accountId === acc.id && c.date === today(ctx))) fail("La caisse a déjà été clôturée aujourd'hui.");
    const expected = accountBalance(d, acc.id);
    const diff = input.counted - expected;
    if (diff !== 0 && !input.note.trim()) fail("Un écart de caisse doit être justifié.");
    d.closings.unshift({ id: uid("clo"), date: today(ctx), accountId: acc.id, expected, counted: input.counted, userId: ctx.user.id, note: input.note });
    audit(d, ctx, { module: "Finances", action: "Clôture de caisse", target: acc.name, oldValue: String(expected), newValue: String(input.counted), reason: input.note });
    return { message: diff === 0 ? "Caisse clôturée sans écart." : `Caisse clôturée avec un écart de ${diff} F (justifié).` };
  });

export const requestCredit: Service<{ clientId: string; ceiling: number; dueDate: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    positive(input.ceiling, "Le plafond");
    if (!input.reason.trim()) fail("Motif requis.");
    if (!input.dueDate || input.dueDate <= today(ctx)) fail("Échéance future requise.");
    must(d.clients.find((c) => c.id === input.clientId), "Client requis.");
    if (d.credits.some((c) => c.clientId === input.clientId && c.status === "en_attente")) fail("Une demande est déjà en attente pour ce client.");
    const code = nextCode(d, "credit", "CRD");
    d.credits.unshift({ id: uid("crd"), code, ...input, requestedById: ctx.user.id, date: today(ctx), status: "en_attente", history: [{ date: ctx.now, userId: ctx.user.id, action: "Demande de crédit créée", note: input.reason }] });
    notify(d, ctx, { title: "Crédit en attente DG", body: `${code} : plafond ${input.ceiling} F.`, level: "info", link: "/finances/credits" });
    audit(d, ctx, { module: "Finances", action: "Demande de crédit", target: code, newValue: String(input.ceiling), reason: input.reason });
    return { message: `Demande ${code} transmise : autorisation préalable du DG requise.` };
  });

export const decideCredit: Service<{ id: string; approve: boolean; note: string }> = (db, ctx, { id, approve, note }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "autorisation de crédit");
    requireOnline(ctx, "Autorisation de crédit");
    const c = must(d.credits.find((x) => x.id === id));
    if (c.status !== "en_attente") fail("Demande déjà traitée.");
    if (!note.trim()) fail("Un commentaire de décision est requis.");
    c.status = approve ? "approuve" : "refuse";
    c.decidedById = ctx.user.id;
    c.decidedAt = ctx.now;
    c.decisionNote = note;
    c.history.push({ date: ctx.now, userId: ctx.user.id, action: approve ? "Crédit approuvé" : "Crédit refusé", note });
    audit(d, ctx, { module: "Finances", action: "Décision de crédit", target: c.code, oldValue: "En attente DG", newValue: approve ? "Approuvé" : "Refusé", reason: note, decision: approve ? "Approuvé" : "Refusé" });
    return { message: approve ? "Crédit approuvé par le DG." : "Crédit refusé." };
  });

export const createOpeningReceivable: Service<{ clientId: string; label: string; amount: number; originDate: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "saisie de solde d'ouverture");
    positive(input.amount, "Le montant");
    if (!input.originDate) fail("Date d'origine requise.");
    const code = nextCode(d, "receivable", "SOI");
    d.openingReceivables.unshift({ id: uid("or"), code, ...input });
    audit(d, ctx, { module: "Finances", action: "Créance d'ouverture", target: code, newValue: String(input.amount) });
    return { message: `Créance d'ouverture ${code} enregistrée (distincte des ventes nouvelles).` };
  });

export const setOpeningBalance: Service<{ accountId: string; amount: number; date: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "solde d'ouverture");
    requireOnline(ctx, "Changement de politique financière");
    const a = must(d.accounts.find((x) => x.id === input.accountId));
    const old = a.openingBalance;
    a.openingBalance = input.amount;
    a.openingDate = input.date;
    audit(d, ctx, { module: "Finances", action: "Solde d'ouverture", target: a.name, oldValue: String(old), newValue: String(input.amount) });
    return { message: "Solde d'ouverture mis à jour." };
  });
