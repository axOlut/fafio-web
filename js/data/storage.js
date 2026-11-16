// Stockage hors ligne : brouillons et images dans IndexedDB (tout reste sur le téléphone).
const DB = "fafio", VERSION = 1;
let dbp = null;

function db() {
    if (!dbp) {
        dbp = new Promise((resolve, reject) => {
            const r = indexedDB.open(DB, VERSION);
            r.onupgradeneeded = () => {
                const d = r.result;
                if (!d.objectStoreNames.contains("drafts")) d.createObjectStore("drafts", { keyPath: "id" });
                if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }
    return dbp;
}

async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        const req = fn(s);
        if (req) req.onsuccess = () => { out = req.result; };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    });
}

// ---------------------------------------------------------------- Brouillons

export const Drafts = {
    async list() {
        const all = (await tx("drafts", "readonly", (s) => s.getAll())) || [];
        return all.sort((a, b) => b.updated - a.updated);
    },
    get: (id) => tx("drafts", "readonly", (s) => s.get(id)),
    async save(draft) {
        draft.updated = Date.now();
        await tx("drafts", "readwrite", (s) => s.put(draft));
        return draft;
    },
    async remove(id) {
        const d = await this.get(id);
        if (d) for (const ref of imageRefs(d.data)) await Images.remove(ref);
        await tx("drafts", "readwrite", (s) => s.delete(id));
    },
    newId: () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
};

/** Toutes les références d'images utilisées par un brouillon. */
export function imageRefs(data) {
    const out = new Set();
    const scan = (obj) => { for (const [k, v] of Object.entries(obj || {})) if (typeof v === "string" && v.startsWith("img_") && (k.endsWith("__img") || k === "image" || k.startsWith("cv_logo"))) out.add(v); };
    scan(data.values);
    for (const items of Object.values(data.groups || {})) for (const it of items) scan(it);
    return out;
}

// ---------------------------------------------------------------- Images

export const Images = {
    /** Importe une photo : redimensionnée (1800 px max), corrigée de son orientation, en JPEG. */
    async importFile(file) {
        let bmp;
        try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
        catch (e) { bmp = await createImageBitmap(file); }
        const max = 1800;
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const c = cv.getContext("2d");
        c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
        c.drawImage(bmp, 0, 0, w, h);
        const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.88));
        const id = "img_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await tx("images", "readwrite", (s) => s.put({ id, blob, w, h }));
        return id;
    },
    get: (id) => tx("images", "readonly", (s) => s.get(id)),
    remove: (id) => tx("images", "readwrite", (s) => s.delete(id)),
    async bytes(id) {
        const r = await this.get(id);
        if (!r) return null;
        return { data: new Uint8Array(await r.blob.arrayBuffer()), w: r.w, h: r.h };
    },
    async url(id) {
        const r = await this.get(id);
        return r ? URL.createObjectURL(r.blob) : null;
    },
};

// ---------------------------------------------------------------- Réglages

export const Settings = {
    get(k, def) { try { const v = localStorage.getItem("fafio." + k); return v == null ? def : v; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem("fafio." + k, v); } catch (e) { /* stockage indisponible */ } },
};
