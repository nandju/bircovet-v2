/** Transforme un lien YouTube ou Google Drive en lien intégrable. */
export function embedOf(url?: string): { src: string; host: "YouTube" | "Drive" } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{6,})/i);
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`, host: "YouTube" };
  const dr = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{10,})/i);
  if (dr) return { src: `https://drive.google.com/file/d/${dr[1]}/preview`, host: "Drive" };
  return null;
}
