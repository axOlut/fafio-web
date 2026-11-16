// Outils scientifiques : membres du groupe, calculs, tableaux de mesures, régression (copie de Science.kt).
import { t, F, G, number } from "./model.js";
import { Block } from "../doc.js";

export const MEMBER_COLUMNS = [t("Nom", "Surname", "اللقب"), t("Prénom", "First name", "الاسم"), t("Matricule", "Reg. no.", "رقم التسجيل")];
const MEMBER_IDS = ["nom", "prenom", "matricule"];

export function membersGroup(label) {
    return G("members", label, t("Personne", "Person", "شخص"), [
        F("nom", t("Nom", "Surname", "اللقب")),
        F("prenom", t("Prénom(s)", "First name(s)", "الاسم")),
        F("matricule", t("Matricule", "Registration number", "رقم التسجيل")),
    ], { startItems: 1, columns: MEMBER_COLUMNS });
}

/** Colonnes cochées d'un groupe (toutes par défaut). */
export function columnsOn(values, g) {
    const v = String(values[`${g.id}_cols`] || "");
    return g.columns.map((_, i) => v[i] !== "0");
}

export function members(f, g, lang) {
    const items = f.items(g.id);
    const on = columnsOn(f.values, g);
    const keep = MEMBER_IDS.map((_, i) => i).filter((i) => on[i] !== false && items.some((it) => String(it[MEMBER_IDS[i]] || "").trim()));
    if (!keep.length) return [[], []];
    return [keep.map((i) => MEMBER_COLUMNS[i].get(lang)), items.map((it) => keep.map((i) => String(it[MEMBER_IDS[i]] || "").trim()))];
}

export function memberNames(f, g, fallback) {
    const names = f.items(g.id).map((it) => [it.nom, it.prenom].map((x) => String(x || "").trim()).filter((x) => x).join(" ")).filter((x) => x);
    return names.length ? names.join("\n") : fallback;
}

export function applyMembers(doc, f, g, lang, fallback) {
    const [h, r] = members(f, g, lang);
    doc.memberHeader = h; doc.members = r; doc.author = memberNames(f, g, fallback);
}

// ---------------------------------------------------------------- Calculatrice

const isLetter = (c) => /[\p{L}_]/u.test(c);
const isDigit = (c) => c >= "0" && c <= "9";

export function calc(src, vars) {
    let i = 0;
    const skip = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const expr = () => {
        let v = term();
        for (;;) { skip(); const c = src[i]; if (c === "+") { i++; v += term(); } else if (c === "-" || c === "−") { i++; v -= term(); } else return v; }
    };
    const term = () => {
        let v = power();
        for (;;) { skip(); const c = src[i]; if (c === "*" || c === "×" || c === "·") { i++; v *= power(); } else if (c === "/" || c === "÷") { i++; v /= power(); } else return v; }
    };
    const power = () => {
        const b = unary(); skip();
        if (src[i] === "^") { i++; return Math.pow(b, power()); }
        if (src[i] === "²") { i++; return b * b; }
        if (src[i] === "³") { i++; return b * b * b; }
        return b;
    };
    const unary = () => { skip(); if (src[i] === "-" || src[i] === "−") { i++; return -unary(); } if (src[i] === "+") { i++; return unary(); } return atom(); };
    const atom = () => {
        skip();
        if (i >= src.length) throw new Error("incomplet");
        const c = src[i];
        if (c === "(") { i++; const v = expr(); skip(); if (src[i] === ")") i++; return v; }
        if (isDigit(c) || c === "." || c === ",") {
            const st = i;
            while (i < src.length && (isDigit(src[i]) || src[i] === "." || src[i] === ",")) i++;
            if ((src[i] === "e" || src[i] === "E") && (isDigit(src[i + 1] || "") || src[i + 1] === "-")) { i += 2; while (isDigit(src[i] || "")) i++; }
            return Number(src.slice(st, i).replace(",", "."));
        }
        if (isLetter(c)) {
            const st = i;
            while (i < src.length && (isLetter(src[i]) || isDigit(src[i]))) i++;
            const name = src.slice(st, i);
            skip();
            if (src[i] === "(") {
                i++; const a = expr(); skip(); if (src[i] === ")") i++;
                const fn = { sqrt: Math.sqrt, racine: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs }[name.toLowerCase()];
                if (!fn) throw new Error("fonction inconnue");
                return fn(a);
            }
            if (name.toLowerCase() === "pi") return Math.PI;
            if (name in vars) return vars[name];
            throw new Error("grandeur inconnue : " + name);
        }
        throw new Error("caractère inattendu");
    };
    const v = expr(); skip();
    if (i < src.length) throw new Error("caractère inattendu");
    return v;
}

export function fmtNum(v, comma) {
    if (!isFinite(v)) return "—";
    const a = Math.abs(v);
    const decimals = a === 0 ? 0 : a >= 1000 ? 2 : a >= 1 ? 4 : Math.min(8, Math.max(4, 4 - Math.floor(Math.log10(a)) - 1));
    let s = (Math.round(v * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
    return comma ? s.replace(".", ",") : s;
}

const quantityName = (cell) => cell.split("(")[0].trim();

/** Tableau de mesures (grandeurs en lignes si rowsMode), avec grandeurs calculées. */
export function measureTable(data, rowsMode, formulas) {
    const parsed = String(data || "").split("\n").map((l) => l.trim()).filter((l) => l).map((l) => l.split(/[;\t]/).map((x) => x.trim()));
    if (!parsed.length) return null;
    const comma = String(data).includes(",");
    const labels = [], series = [];
    if (rowsMode) for (const r of parsed) { labels.push(r[0]); series.push(r.slice(1)); }
    else parsed[0].forEach((hd, c) => { labels.push(hd); series.push(parsed.slice(1).map((r) => r[c] || "")); });
    for (const line of String(formulas || "").split("\n").map((l) => l.trim()).filter((l) => l.includes("="))) {
        const label = line.slice(0, line.indexOf("=")).trim(), ex = line.slice(line.indexOf("=") + 1).trim();
        const n = Math.max(0, ...series.map((x) => x.length));
        const out = Array.from({ length: n }, (_, k) => {
            const vars = {};
            labels.forEach((lab, si) => { const v = number(series[si][k] || ""); if (v != null) vars[quantityName(lab)] = v; });
            try { return fmtNum(calc(ex, vars), comma); } catch (e) { return "—"; }
        });
        labels.push(label); series.push(out);
    }
    const n = Math.max(0, ...series.map((x) => x.length));
    if (rowsMode) {
        const b = Block.table([], labels.map((lab, si) => [lab, ...Array.from({ length: n }, (_, k) => series[si][k] || "")]));
        b.rowHeader = true;
        return b;
    }
    return Block.table(labels, Array.from({ length: n }, (_, k) => series.map((x) => x[k] || "")));
}

export function regression(points) {
    if (points.length < 2) return null;
    const n = points.length;
    const mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n;
    const sxx = points.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    if (sxx === 0) return null;
    const sxy = points.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
    const a = sxy / sxx, b = my - a * mx;
    const ssTot = points.reduce((s, p) => s + (p[1] - my) ** 2, 0);
    const ssRes = points.reduce((s, p) => s + (p[1] - (a * p[0] + b)) ** 2, 0);
    return [a, b, ssTot === 0 ? 1 : 1 - ssRes / ssTot];
}

export function equation(a, b, comma) {
    return "y = " + fmtNum(a, comma) + "x" + (b < 0 ? " − " + fmtNum(-b, comma) : " + " + fmtNum(b, comma));
}
