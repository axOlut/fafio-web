// Modèle des formulaires (copie de FormModel.kt + Build.kt).
import { Doc, Block, lines } from "../doc.js";

/** Texte en trois langues. */
export class T {
    constructor(fr, en, ar) { this.fr = fr; this.en = en; this.ar = ar; }
    get(lang) { return lang === "en" ? this.en : lang === "ar" ? this.ar : this.fr; }
}
export const t = (fr, en, ar) => new T(fr, en, ar);

export const TODAY = "@today";
export const YEAR = "@year";

/**
 * Champ : type TEXT, MULTILINE, LIST, DATE, NUMBER, CHOICE, PHONE, EMAIL, IMAGE, SECTION.
 * o = { type, hint, required, options, def, defT, visibleIf: [id, valeur] }
 */
export function F(id, label, o = {}) {
    return {
        id, label, type: o.type || "TEXT", hint: o.hint || null, required: !!o.required, options: o.options || [],
        def: o.def || "", defT: o.defT || null, visibleIf: o.visibleIf || null,
    };
}

export function isVisible(f, values) {
    const c = f.visibleIf;
    if (!c) return true;
    const v = (values[c[0]] || "") || "0";
    return c[1].startsWith("!") ? v !== c[1].slice(1) : c[1].split("|").includes(v);
}

export function G(id, label, itemLabel, fields, o = {}) {
    return { id, label, itemLabel, fields, minItems: o.minItems || 0, startItems: o.startItems === undefined ? 1 : o.startItems, columns: o.columns || [] };
}

// ---------------------------------------------------------------- Données saisies

export function academicYear() {
    const d = new Date();
    const y = d.getFullYear();
    const start = d.getMonth() >= 8 ? y : y - 1;
    return `${start}/${start + 1}`;
}

export function today(lang) {
    const loc = lang === "en" ? "en-GB" : lang === "ar" ? "ar" : "fr-FR";
    try { return new Date().toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date().toLocaleDateString(); }
}

/** Formulaire vierge avec les valeurs par défaut et les groupes pré-remplis. */
export function blank(type, lang) {
    const values = {};
    for (const f of [...type.fields, ...(type.coverFields || [])]) {
        let v;
        if (f.type === "DATE" && f.def === TODAY) v = today(lang);
        else if (f.def === YEAR) v = academicYear();
        else if (f.defT) v = f.defT.get(lang);
        else v = f.def;
        if (v) values[f.id] = v;
    }
    const groups = {};
    for (const g of type.groups || []) groups[g.id] = Array.from({ length: g.startItems }, () => ({}));
    if ((type.defaultCoverModel || 0) > 0) values.cv_model = String(type.defaultCoverModel);
    // Présentations : un design illustré par défaut (image de diapositive)
    return { values, groups, style: "MODERN", cover: !!type.defaultCover, theme: type.module === "SLIDES" ? "corporate" : "", font: "" };
}

/** Accès pratique aux valeurs pendant la construction. */
export class Form {
    constructor(data) {
        this.values = data.values || {};
        this.groups = data.groups || {};
        this.style = data.style || "MODERN";
        this.cover = !!data.cover;
        this.theme = data.theme || "";
        this.font = data.font || "";
    }
    v(id) { return String(this.values[id] || "").trim(); }
    items(groupId) { return (this.groups[groupId] || []).filter((it) => Object.values(it).some((x) => String(x || "").trim())); }
    choice(id) { const n = parseInt(this.v(id), 10); return isNaN(n) ? 0 : n; }
}

// ---------------------------------------------------------------- Aides de construction

export const imgKey = (id) => `${id}__img`;
export const capKey = (id) => `${id}__cap`;
export const hasImg = (values, id) => String(values[imgKey(id)] || "").trim() !== "";

export function parseTable(text) {
    const rows = String(text || "").split("\n").map((l) => l.trim()).filter((l) => l).map((l) => l.split(/[;\t]/).map((x) => x.trim()));
    if (!rows.length) return null;
    return [rows[0], rows.slice(1)];
}

export function number(s) {
    const v = String(s || "").trim().replace(/ /g, "").replace(",", ".");
    if (v === "" || isNaN(Number(v))) return null;
    return Number(v);
}

export function formatNumber(v) {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return v.toFixed(2).replace(/0+$/, "").replace(/[.,]$/, "");
}

/** Constructeur de document avec les mêmes aides que Build.kt. */
export class B extends Doc {
    docTitle(text, size = 0) { if (String(text).trim()) { const b = Block.heading(text, 0); if (size > 0) b.size(size); this.add(b); } return this; }
    heading(text, level = 1) { if (String(text).trim()) this.add(Block.heading(text, level)); return this; }
    para(text) { if (String(text).trim()) this.add(Block.para(text)); return this; }
    line(text, align = "LEFT", bold = false) { if (String(text).trim()) this.add(Block.para(text, align, bold)); return this; }
    bullets(text) { this.add(Block.bullets(lines(text))); return this; }
    numbered(text) { this.add(Block.numbered(lines(text))); return this; }
    table(text) { const tb = parseTable(text); if (tb) this.add(Block.table(tb[0], tb[1])); return this; }
    slot(values, id) { this.add(Block.slot(values[imgKey(id)] || "", values[capKey(id)] || "")); return this; }
    last() { return this.blocks[this.blocks.length - 1]; }

    /** Rubrique complète : titre + contenu + image éventuelle. */
    rubric(values, id, title, kind = "PARA", level = 1) {
        const text = String(values[id] || "").trim();
        const hasText = kind === "TABLE" ? parseTable(text) != null : (kind === "BULLETS" || kind === "NUMBERED") ? lines(text).length > 0 : text !== "";
        if (!hasText && !hasImg(values, id)) return this;
        this.heading(title, level);
        if (hasText) this.contentText(text, kind);
        return this.slot(values, id);
    }
    content(values, id, kind = "PARA") {
        const text = String(values[id] || "").trim();
        if (text) this.contentText(text, kind);
        return this.slot(values, id);
    }
    contentText(text, kind) {
        switch (kind) {
            case "BULLETS": return this.bullets(text);
            case "NUMBERED": return this.numbered(text);
            case "TABLE": return this.table(text);
            case "RICH": return this.rich(text);
            default: return this.para(text);
        }
    }
    /** « # » = sous-titre, « - » = puce. */
    rich(text, subLevel = 2) {
        let bl = [];
        const flush = () => { if (bl.length) { this.add(Block.bullets(bl)); bl = []; } };
        for (const raw of String(text).split("\n")) {
            const l = raw.trim();
            if (!l) flush();
            else if (l.startsWith("#")) { flush(); this.heading(l.replace(/^#+/, "").trim(), subLevel); }
            else if (/^[-•*]/.test(l)) bl.push(l.replace(/^[-•*]+/, "").trim());
            else { flush(); this.para(l); }
        }
        flush();
        return this;
    }
}
