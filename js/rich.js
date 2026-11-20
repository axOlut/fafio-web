// Contenu inséré dans les champs (équations affichées, images, graphiques, tableaux) : copie fidèle de Rich.java.
import { Block } from "./doc.js";
import { displayOf, numbered, toUnicode, inlineToUnicode, inlineSpans } from "./math.js";

export const OBJ = "obj.";
export const SEP = "\u001F";
const MARKER = /^\[\[(image|graphique|tableau|chart|table|figure):([A-Za-z0-9_-]+)\]\]$/;

export function object(values, id) {
    const v = values ? values[OBJ + id] : null;
    if (!v) return [];
    return String(v).split(SEP);
}
export const field = (o, i) => (i < o.length ? o[i] : "");

const special = (t) => t != null && (t.includes("$$") || t.includes("\\[") || t.includes("[["));

export function expand(doc, values) {
    const out = [];
    for (const b of doc.blocks) {
        if ((b.type === "BULLETS" || b.type === "NUMBERED") && special(b.items.join("\n"))) {
            let run = [];
            const flushList = () => { if (!run.length) return; const l = b.withText(""); l.items = run; run = []; out.push(l); };
            for (const item of b.items) {
                const tex = displayOf(item);
                const objs = tex != null ? null : marker(item.trim(), values);
                if (tex == null && objs == null) { run.push(item); continue; }
                flushList();
                if (tex != null) out.push(Block.math(tex)); else out.push(...objs);
            }
            flushList();
            continue;
        }
        if (b.type !== "PARAGRAPH" || !special(b.text)) { out.push(b); continue; }
        let buf = "";
        const flush = () => { const t = buf.trim(); buf = ""; if (t) out.push(b.withText(t)); };
        for (const line of b.text.split(/\r?\n/)) {
            const tex = displayOf(line);
            if (tex == null && line.includes("$$")) {
                let found = false, last = 0;
                for (const sp of inlineSpans(line)) {
                    if (!line.startsWith("$$", sp[0])) continue;
                    found = true;
                    const before = line.substring(last, sp[0]);
                    if (!/^[-•*]$/.test(before.trim())) buf += before;
                    flush();
                    out.push(Block.math(line.substring(sp[2], sp[3])));
                    last = sp[1];
                }
                if (found) { buf += line.substring(last) + "\n"; continue; }
            }
            const objs = tex != null ? null : marker(line.trim(), values);
            if (tex == null && objs == null) { buf += line + "\n"; continue; }
            flush();
            if (tex != null) out.push(Block.math(tex)); else out.push(...objs);
        }
        flush();
    }
    doc.blocks.length = 0;
    doc.blocks.push(...out);
    let n = 0;
    for (const b of doc.blocks) {
        if (b.type !== "MATH") continue;
        if (numbered(b.text)) { n++; b.num = "(" + n + ")"; }
    }
}

function marker(line, values) {
    if (!line.startsWith("[[")) return null;
    const m = MARKER.exec(line);
    if (!m) return null;
    const o = object(values, m[2]);
    const list = [];
    if (o.length === 0) return list;
    const kind = o[0];
    if (kind === "image") {
        const s = Block.slot(field(o, 1), field(o, 2));
        if (s) list.push(s);
    } else if (kind === "chart") {
        const c = Block.of("CHART");
        c.text = values[OBJ + m[2]];
        c.legend = field(o, 2).trim();
        list.push(c);
    } else if (kind === "table") {
        const rows = [];
        for (const l of field(o, 2).split(/\r?\n/)) {
            if (!l.trim()) continue;
            rows.push(l.split(/[;\t]/).map((c) => c.trim()));
        }
        if (rows.length === 0) return list;
        const header = field(o, 3) !== "0";
        const cap = Block.para("", "CENTER", true).size(10);
        cap.legend = field(o, 1).trim();
        cap.tableCaption = true;
        list.push(cap);
        list.push(header ? Block.table(rows[0], rows.slice(1)) : Block.table([], rows));
    }
    return list;
}

let keep = false;

/** keepInline (PDF) : les « $…$ » restent pour être dessinés dans la ligne. */
export function linearize(doc, keepInline = false) {
    keep = keepInline;
    try { linearizeAll(doc); } finally { keep = false; }
}

function linearizeAll(doc) {
    doc.title = uni(doc.title);
    doc.subtitle = uni(doc.subtitle);
    for (const b of doc.blocks) {
        if (b.type === "MATH" || b.type === "CHART") continue;
        b.text = uni(b.text);
        uniList(b.items); uniList(b.header);
        for (const r of b.rows) uniList(r);
    }
    for (const s of doc.slides) {
        s.title = uni(s.title); s.caption = uni(s.caption);
        uniList(s.bullets); uniList(s.tableHeader);
        for (const r of s.tableRows) uniList(r);
    }
}

function uniList(l) { for (let i = 0; i < l.length; i++) l[i] = uni(l[i]); }

export function uni(s) {
    if (s == null || (s.indexOf("$") < 0 && !s.includes("\\["))) return s;
    return s.split("\n").map((line) => {
        const tex = displayOf(line);
        if (keep) return tex != null ? "$" + tex + "$" : line;
        return tex != null ? toUnicode(tex) : inlineToUnicode(line);
    }).join("\n");
}
