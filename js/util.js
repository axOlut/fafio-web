// Outils communs : petits compléments « à la Java » utilisés par les générateurs, ZIP, XML.

/* eslint-disable no-extend-native */
if (!String.prototype.isEmpty) {
    Object.defineProperty(String.prototype, "isEmpty", { value: function () { return this.length === 0; } });
    Object.defineProperty(String.prototype, "equals", { value: function (o) { return this === String(o); } });
    Object.defineProperty(String.prototype, "contains", { value: function (o) { return this.includes(o); } });
    Object.defineProperty(Array.prototype, "isEmpty", { value: function () { return this.length === 0; } });
    Object.defineProperty(Array.prototype, "get", { value: function (i) { return this[i]; } });
    Object.defineProperty(Array.prototype, "add", {
        value: function (a, b) { if (arguments.length === 2) this.splice(a, 0, b); else this.push(a); return true; },
    });
}

/** Équivalent minimal de StringBuilder. */
export class SB {
    constructor(s = "") { this.s = String(s); }
    append(x) { this.s += String(x); return this; }
    get length() { return this.s.length; }
    substring(a, b) { return this.s.substring(a, b); }
    setLength(n) { this.s = this.s.substring(0, n); }
    toString() { return this.s; }
}

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export function esc(s) {
    if (s == null) return "";
    let out = "";
    for (const ch of String(s)) {
        switch (ch) {
            case "&": out += "&amp;"; break;
            case "<": out += "&lt;"; break;
            case ">": out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case "'": out += "&apos;"; break;
            default: {
                const c = ch.codePointAt(0);
                if (c === 0x9 || c === 0xA || c === 0xD || (c >= 0x20 && c <= 0xD7FF) || (c >= 0xE000 && c <= 0xFFFD) || c > 0xFFFF) out += ch;
            }
        }
    }
    return out;
}

export function hex(argb) {
    return ((argb >>> 0) & 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
}

const enc = new TextEncoder();

// ---------------------------------------------------------------- ZIP (sans compression)

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

class ZipBuilder {
    constructor() { this.entries = []; }
    put(name, content) {
        const data = typeof content === "string" ? enc.encode(content) : new Uint8Array(content);
        this.entries.push({ name: enc.encode(name), data, crc: crc32(data) });
    }
    finish() {
        let size = 22;
        for (const e of this.entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
        const out = new Uint8Array(size);
        const v = new DataView(out.buffer);
        let p = 0;
        const offsets = [];
        const d = new Date();
        const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
        const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        for (const e of this.entries) {
            offsets.push(p);
            v.setUint32(p, 0x04034b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 0x0800, true);
            v.setUint16(p + 8, 0, true); v.setUint16(p + 10, time, true); v.setUint16(p + 12, date, true);
            v.setUint32(p + 14, e.crc, true); v.setUint32(p + 18, e.data.length, true); v.setUint32(p + 22, e.data.length, true);
            v.setUint16(p + 26, e.name.length, true); v.setUint16(p + 28, 0, true);
            out.set(e.name, p + 30); p += 30 + e.name.length;
            out.set(e.data, p); p += e.data.length;
        }
        const cd = p;
        this.entries.forEach((e, i) => {
            v.setUint32(p, 0x02014b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 20, true); v.setUint16(p + 8, 0x0800, true);
            v.setUint16(p + 10, 0, true); v.setUint16(p + 12, time, true); v.setUint16(p + 14, date, true);
            v.setUint32(p + 16, e.crc, true); v.setUint32(p + 20, e.data.length, true); v.setUint32(p + 24, e.data.length, true);
            v.setUint16(p + 28, e.name.length, true); v.setUint16(p + 30, 0, true); v.setUint16(p + 32, 0, true);
            v.setUint16(p + 34, 0, true); v.setUint16(p + 36, 0, true); v.setUint32(p + 38, 0, true); v.setUint32(p + 42, offsets[i], true);
            out.set(e.name, p + 46); p += 46 + e.name.length;
        });
        v.setUint32(p, 0x06054b50, true); v.setUint16(p + 8, this.entries.length, true); v.setUint16(p + 10, this.entries.length, true);
        v.setUint32(p + 12, p - cd, true); v.setUint32(p + 16, cd, true);
        return out;
    }
}

export const Zip = {
    open: () => new ZipBuilder(),
    put: (zip, name, content) => zip.put(name, content),
    coreProps(title, creator) {
        const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        return XML_HEAD
            + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            + 'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            + "<dc:title>" + esc(title) + "</dc:title><dc:creator>" + esc(creator) + "</dc:creator>"
            + "<cp:lastModifiedBy>FAFIO</cp:lastModifiedBy>"
            + '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + "</dcterms:created>"
            + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + "</dcterms:modified></cp:coreProperties>";
    },
};

// ---------------------------------------------------------------- Compression (deflate) d'un ZIP produit ci-dessus

async function deflateRaw(data) {
    const cs = new CompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Recompresse un ZIP « stocké » (Word, PowerPoint) pour réduire sa taille. Sans support : renvoie l'original. */
export async function compressZip(bytes) {
    if (typeof CompressionStream === "undefined") return bytes;
    try {
        const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const entries = [];
        let p = 0;
        while (p + 30 <= bytes.length && v.getUint32(p, true) === 0x04034b50) {
            const crc = v.getUint32(p + 14, true), size = v.getUint32(p + 18, true), nlen = v.getUint16(p + 26, true), xlen = v.getUint16(p + 28, true);
            const name = bytes.subarray(p + 30, p + 30 + nlen);
            const start = p + 30 + nlen + xlen;
            entries.push({ name, crc, data: bytes.subarray(start, start + size) });
            p = start + size;
        }
        const out = [];
        for (const e of entries) {
            const comp = /\.(jpe?g|png)$/i.test(new TextDecoder().decode(e.name)) ? null : await deflateRaw(e.data);
            out.push({ ...e, comp: comp && comp.length < e.data.length ? comp : null });
        }
        let total = 22;
        for (const e of out) total += 30 + 46 + 2 * e.name.length + (e.comp || e.data).length;
        const r = new Uint8Array(total);
        const w = new DataView(r.buffer);
        let q = 0;
        const offs = [];
        for (const e of out) {
            const body = e.comp || e.data, method = e.comp ? 8 : 0;
            offs.push(q);
            w.setUint32(q, 0x04034b50, true); w.setUint16(q + 4, 20, true); w.setUint16(q + 6, 0x0800, true); w.setUint16(q + 8, method, true);
            w.setUint32(q + 14, e.crc, true); w.setUint32(q + 18, body.length, true); w.setUint32(q + 22, e.data.length, true);
            w.setUint16(q + 26, e.name.length, true);
            r.set(e.name, q + 30); q += 30 + e.name.length; r.set(body, q); q += body.length;
        }
        const cd = q;
        out.forEach((e, i) => {
            const body = e.comp || e.data, method = e.comp ? 8 : 0;
            w.setUint32(q, 0x02014b50, true); w.setUint16(q + 4, 20, true); w.setUint16(q + 6, 20, true); w.setUint16(q + 8, 0x0800, true); w.setUint16(q + 10, method, true);
            w.setUint32(q + 16, e.crc, true); w.setUint32(q + 20, body.length, true); w.setUint32(q + 24, e.data.length, true);
            w.setUint16(q + 28, e.name.length, true); w.setUint32(q + 42, offs[i], true);
            r.set(e.name, q + 46); q += 46 + e.name.length;
        });
        w.setUint32(q, 0x06054b50, true); w.setUint16(q + 8, out.length, true); w.setUint16(q + 10, out.length, true);
        w.setUint32(q + 12, q - cd, true); w.setUint32(q + 16, cd, true);
        return r;
    } catch (e) { return bytes; }
}
