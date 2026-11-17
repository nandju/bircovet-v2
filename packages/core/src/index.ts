// Point d'entrée du paquet partagé @cliva/core.
//
// Ce fichier ne contient AUCUNE logique : il ré-exporte le code métier qui vit
// encore dans l'application front (src/lib). C'est volontaire : déplacer
// physiquement les fichiers fera l'objet d'une étape ultérieure (voir
// docs/AUDIT.md §3.5). L'API et le front importent déjà via "@cliva/core",
// donc le futur déménagement sera transparent pour eux.

export * from "../../../src/lib/types";
export { SCHEMA_VERSION, createSeed } from "../../../src/lib/seed";
export * from "../../../src/lib/permissions";
