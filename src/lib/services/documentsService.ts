import { uid } from "../format";
import type { DocumentItem } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

export type DocumentInput = Pick<DocumentItem, "title" | "category" | "linked" | "fileName" | "mimeType" | "size" | "contentText" | "localOnly">;

/**
 * Ajout de document (démonstration) : seules les métadonnées sont persistées.
 * Le contenu binaire d'un fichier choisi reste en URL temporaire dans le navigateur ;
 * le stockage sécurisé sera assuré par le backend.
 */
export const addDocument: Service<DocumentInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Titre requis.");
    if (!input.linked.id) fail("Dossier associé requis.");
    const id = uid("doc");
    d.documents.unshift({ ...input, id, authorId: ctx.user.id, date: ctx.now.slice(0, 10), version: 1, status: "actif" });
    audit(d, ctx, { module: "Documents", action: "Ajout de document", target: input.title });
    return { message: "Document ajouté.", data: id };
  });

export const newDocumentVersion: Service<{ id: string; fileName: string; size: number; mimeType: string; contentText?: string; localOnly?: boolean }> = (db, ctx, input) =>
  produce(db, (d) => {
    const doc = must(d.documents.find((x) => x.id === input.id));
    if (doc.status === "archive") fail("Document archivé.");
    Object.assign(doc, { fileName: input.fileName, size: input.size, mimeType: input.mimeType, contentText: input.contentText ?? doc.contentText, localOnly: input.localOnly, version: doc.version + 1, date: ctx.now.slice(0, 10), authorId: ctx.user.id });
    audit(d, ctx, { module: "Documents", action: "Nouvelle version", target: doc.title, newValue: `v${doc.version}` });
    return { message: `Version ${doc.version} enregistrée.` };
  });

export const setDocumentArchived: Service<{ id: string; archived: boolean }> = (db, ctx, { id, archived }) =>
  produce(db, (d) => {
    const doc = must(d.documents.find((x) => x.id === id));
    doc.status = archived ? "archive" : "actif";
    audit(d, ctx, { module: "Documents", action: archived ? "Archivage" : "Restauration", target: doc.title });
    return { message: archived ? "Document archivé." : "Document restauré." };
  });
