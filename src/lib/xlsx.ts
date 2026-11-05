/**
 * Lecture minimale d'un classeur Excel (.xlsx) dans le navigateur, sans bibliothèque :
 * un .xlsx est une archive ZIP de fichiers XML. On lit la première feuille (ou celle demandée)
 * et on renvoie ses cellules en texte, ligne par ligne.
 */

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

interface ZipEntry {
  name: string;
  method: number;
  size: number;
  offset: number;
}

function zipEntries(b: Uint8Array): ZipEntry[] {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--)
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) valide.");
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const offset = u32(b, p + 42);
    out.push({ name: dec.decode(b.subarray(p + 46, p + 46 + nameLen)), method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("Ce navigateur ne sait pas ouvrir les fichiers Excel : enregistrez le tableau en CSV puis importez-le.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(b: Uint8Array, e: ZipEntry): Promise<string> {
  const nameLen = u16(b, e.offset + 26);
  const extraLen = u16(b, e.offset + 28);
  const start = e.offset + 30 + nameLen + extraLen;
  const raw = b.subarray(start, start + e.size);
  const bytes = e.method === 0 ? raw : e.method === 8 ? await inflate(raw) : null;
  if (!bytes) throw new Error("Format de compression non pris en charge : enregistrez le tableau en CSV.");
  return new TextDecoder("utf-8").decode(bytes);
}

/** Index de colonne à partir d'une référence de cellule (« C12 » → 2). */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Éléments par nom local, avec ou sans préfixe d'espace de noms (« x:row » ou « row »). */
const els = (n: Document | Element, local: string) => Array.from(n.getElementsByTagNameNS("*", local));
const textOf = (el: Element) => els(el, "t").map((t) => t.textContent ?? "").join("");

export interface SheetData {
  name: string;
  rows: string[][];
}

/** Toutes les feuilles du classeur, dans l'ordre du classeur. */
export async function readXlsx(buf: ArrayBuffer): Promise<SheetData[]> {
  const b = new Uint8Array(buf);
  const entries = zipEntries(b);
  const get = async (name: string) => {
    const e = entries.find((x) => x.name === name);
    return e ? readEntry(b, e) : undefined;
  };
  const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
  const shared: string[] = [];
  const ss = await get("xl/sharedStrings.xml");
  if (ss) for (const si of els(parse(ss), "si")) shared.push(textOf(si));
  const wb = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  const targets = new Map<string, string>();
  if (rels) for (const r of els(parse(rels), "Relationship")) targets.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  const sheets: { name: string; path: string }[] = [];
  if (wb)
    for (const s of els(parse(wb), "sheet")) {
      const rid = s.getAttribute("r:id") ?? s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? "";
      const t = targets.get(rid);
      if (t) sheets.push({ name: s.getAttribute("name") ?? "Feuille", path: t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}` });
    }
  if (!sheets.length) entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).forEach((e, i) => sheets.push({ name: `Feuille ${i + 1}`, path: e.name }));
  const out: SheetData[] = [];
  for (const sh of sheets) {
    const xml = await get(sh.path);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const row of els(parse(xml), "row")) {
      const cells: string[] = [];
      for (const c of els(row, "c")) {
        const ref = c.getAttribute("r");
        const i = ref ? colIndex(ref) : cells.length;
        const t = c.getAttribute("t");
        const v = els(c, "v")[0]?.textContent ?? "";
        const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? textOf(c) : v;
        cells[i] = val;
      }
      rows.push(Array.from(cells, (x) => (x ?? "").trim()));
    }
    out.push({ name: sh.name, rows });
  }
  return out;
}
