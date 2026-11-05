/** Rayons de la vue générale de la pharmacie (catégorie × espèce). */
export interface Shelf {
  key: string;
  group: string;
  label: string;
}

export const SHELVES: Shelf[] = [
  { key: "vac-chien", group: "Vaccins", label: "Chien" },
  { key: "vac-chat", group: "Vaccins", label: "Chat" },
  { key: "vac-volaille", group: "Vaccins", label: "Volailles" },
  { key: "vac-ruminant", group: "Vaccins", label: "Bovins et petits ruminants" },
  { key: "vac-porc", group: "Vaccins", label: "Porc" },
  { key: "apr-chien", group: "Antiparasitaires", label: "Canins" },
  { key: "apr-chat", group: "Antiparasitaires", label: "Félins" },
  { key: "apr-rente", group: "Antiparasitaires", label: "Animaux de rente" },
  { key: "atb-compagnie", group: "Antibiotiques", label: "Animaux de compagnie" },
  { key: "atb-rente", group: "Antibiotiques", label: "Animaux de rente" },
  { key: "ains", group: "Anti-inflammatoires et analgésiques", label: "Toutes espèces" },
  { key: "ali-chien", group: "Aliments", label: "Chien" },
  { key: "ali-chat", group: "Aliments", label: "Chat" },
  { key: "ali-volaille", group: "Aliments", label: "Volailles" },
  { key: "ali-ruminant", group: "Aliments", label: "Ruminants" },
  { key: "ali-porc", group: "Aliments", label: "Porc" },
  { key: "acc-compagnie", group: "Accessoires et matériel", label: "Animaux de compagnie" },
  { key: "acc-rente", group: "Accessoires et matériel", label: "Animaux de rente" },
  { key: "humain", group: "Spécialités humaines", label: "Usage hors AMM" },
  { key: "consommable", group: "Consommables de soins", label: "Clinique et terrain" },
];

export const shelfOf = (key?: string) => SHELVES.find((s) => s.key === key);
export const shelfLabel = (key?: string) => {
  const s = shelfOf(key);
  return s ? `${s.group} · ${s.label}` : "Non classé";
};

/** Rayon par défaut déduit de la catégorie quand l'article n'est pas classé. */
export function defaultShelf(category: string): string | undefined {
  return category === "consommable" ? "consommable" : category === "materiel" ? "acc-compagnie" : undefined;
}
