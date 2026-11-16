// Chargement des polices FAFIO : pour le dessin (aperçu, PDF) et pour l'intégration dans Word.
import { font as fontSpec } from "../forms/themes.js";

const loaded = new Map();
const bytesCache = new Map();

async function fetchBytes(url) {
    if (bytesCache.has(url)) return bytesCache.get(url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(url);
    const b = new Uint8Array(await r.arrayBuffer());
    bytesCache.set(url, b);
    return b;
}

export const fontUrl = (file, bold) => `fonts/f_${file}_${bold ? "b" : "r"}.ttf`;

/** Rend la police utilisable dans les canevas (famille « F-<id> », normal et gras). */
export async function ensureFont(id) {
    const f = fontSpec(id);
    if (!f.file || loaded.has(id)) return loaded.get(id);
    const p = (async () => {
        for (const bold of [false, true]) {
            try {
                const face = new FontFace(`F-${id}`, await fetchBytes(fontUrl(f.file, bold)), { weight: bold ? "700" : "400", style: "normal" });
                await face.load();
                document.fonts.add(face);
            } catch (e) { /* police indisponible : police de secours */ }
        }
    })();
    loaded.set(id, p);
    return p;
}

/** Octets regular / bold d'une police non standard (à intégrer dans le Word). */
export async function fontBytes(id) {
    const f = fontSpec(id);
    if (!f.file || f.standard) return [null, null];
    try { return [await fetchBytes(fontUrl(f.file, false)), await fetchBytes(fontUrl(f.file, true))]; } catch (e) { return [null, null]; }
}

export async function assetBytes(path) {
    try { return await fetchBytes(path); } catch (e) { return null; }
}

export async function assetText(path) {
    const r = await fetch(path);
    return r.text();
}
