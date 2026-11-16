// Modèle de document neutre partagé par tous les exports (copie fidèle de Doc.java / DocTheme.java).
import { hex } from "./util.js";

export function lines(text) {
    const out = [];
    if (text == null) return out;
    for (const l of String(text).split(/\r?\n/)) {
        let t = l.trim();
        while (t.startsWith("-") || t.startsWith("•") || t.startsWith("*")) t = t.substring(1).trim();
        if (t) out.push(t);
    }
    return out;
}

const safe = (s) => (s == null ? "" : String(s).trim());
const clean = (a) => (a || []).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim());

export class Img {
    constructor(data, w, h, type) { this.data = data; this.w = w; this.h = h; this.type = type === "jpeg" ? "jpeg" : "png"; }
}

export class DocTheme {
    constructor() {
        this.id = "modern"; this.primary = 0xFF4F46E5; this.light = 0xFFF5F6FA; this.accent = 0xFF93C5FD;
        this.heading = "UNDERLINE"; this.pageNum = "PIPE"; this.bullet = "•"; this.runningHeader = false;
        this.headFontId = "poppins"; this.bodyFontId = "opensans"; this.headFont = "Poppins"; this.bodyFont = "Open Sans";
        this.headFontR = null; this.headFontB = null; this.bodyFontR = null; this.bodyFontB = null;
        this.coverBg = null; this.slideBg = null; this.darkSlide = false;
        this.pageWord = "Page"; this.ofWord = "sur";
    }
    primaryHex() { return hex(this.primary); }
    lightHex() { return hex(this.light); }
    accentHex() { return hex(this.accent); }
}

export class Block {
    constructor(type) {
        this.type = type; this.text = ""; this.level = 1; this.align = "LEFT"; this.bold = false; this.italic = false;
        this.sizePt = 0; this.accent = false; this.muted = false; this.items = []; this.header = []; this.rows = [];
        this.png = null; this.pxW = 0; this.pxH = 0; this.imgType = "png"; this.lines = 1; this.ref = ""; this.legend = null;
    }
    static heading(text, level) { const b = new Block("HEADING"); b.text = safe(text); b.level = level; if (level === 0) b.align = "CENTER"; return b; }
    static para(text, align, bold) {
        const b = new Block("PARAGRAPH"); b.text = safe(text);
        if (align === undefined) b.align = "JUSTIFY"; else { b.align = align; b.bold = !!bold; }
        return b;
    }
    static bullets(items) { const b = new Block("BULLETS"); b.items = clean(items); return b.items.length ? b : null; }
    static numbered(items) { const b = new Block("NUMBERED"); b.items = clean(items); return b.items.length ? b : null; }
    static table(header, rows) { const b = new Block("TABLE"); b.header = header || []; b.rows = rows || []; return b; }
    static image(data, pxW, pxH, type = "png") {
        if (!data || pxW <= 0 || pxH <= 0) return null;
        const b = new Block("IMAGE"); b.png = data; b.pxW = pxW; b.pxH = pxH; b.imgType = type === "jpeg" ? "jpeg" : "png"; b.align = "CENTER"; return b;
    }
    static field(label, n) { const b = new Block("FIELD"); b.text = safe(label); b.lines = Math.max(1, n); return b; }
    static choices(q, options) { const b = new Block("CHOICES"); b.text = safe(q); b.items = clean(options); return b; }
    static slot(ref, legend) {
        if (!ref || !String(ref).trim()) return null;
        const b = new Block("SLOT"); b.ref = String(ref).trim(); b.legend = legend == null ? "" : String(legend).trim(); return b;
    }
    static spacer() { return new Block("SPACER"); }
    static pageBreak() { return new Block("PAGE_BREAK"); }
    static divider() { return new Block("DIVIDER"); }
    size(pt) { this.sizePt = pt; return this; }
    setBold() { this.bold = true; return this; }
    setItalic() { this.italic = true; return this; }
    setAccent() { this.accent = true; return this; }
    setMuted() { this.muted = true; return this; }
    setAlign(a) { this.align = a; return this; }
}

export class Slide {
    constructor(title, bullets) {
        this.title = safe(title); this.bullets = clean(bullets); this.png = null; this.pxW = 0; this.pxH = 0;
        this.imgType = "png"; this.caption = ""; this.imageRef = ""; this.legend = null; this.statement = false;
    }
    static statement(text) { const s = new Slide(text, []); s.statement = true; return s; }
}

const UNNUMBERED = ["introduction", "conclusion", "références", "references", "reference", "bibliographie", "bibliography",
    "remerciements", "acknowledg", "annexe", "appendix", "résumé", "sommaire", "plan de travail",
    "مقدمة", "خاتمة", "المراجع", "شكر", "ملخص"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

export class Doc {
    constructor() {
        this.title = ""; this.subtitle = ""; this.author = ""; this.institution = ""; this.date = ""; this.extra = ""; this.cover = false;
        this.coverModel = "SIMPLE"; this.headerLeft = ""; this.headerRight = ""; this.logoLeftRef = ""; this.logoRightRef = "";
        this.logoLeft = null; this.logoRight = null; this.supervision = ""; this.group = ""; this.infoLines = "";
        this.participantsLabel = "NOMS DES PARTICIPANTS :"; this.themeLabel = "THEME"; this.supervisionLabel = "Sous la supervision de";
        this.toc = false; this.tocTitle = "PLAN DE TRAVAIL"; this.numberHeadings = false; this.pageWordFooter = false;
        this.style = "MODERN"; this.theme = new DocTheme(); this.rtl = false; this.landscape = false;
        this.blocks = []; this.slides = [];
    }
    add(b) { if (b) this.blocks.push(b); return this; }
    isPresentation() { return this.slides.length > 0; }

    headingLabels() {
        const out = [];
        let n1 = 0, n2 = 0;
        for (const b of this.blocks) {
            if (b.type !== "HEADING" || b.level <= 0) { out.push(null); continue; }
            const t = b.text;
            const lower = t.toLowerCase();
            if (!this.numberHeadings || UNNUMBERED.some((u) => lower.startsWith(u))) {
                out.push(b.level === 1 && this.numberHeadings ? t.toUpperCase() : t);
                continue;
            }
            if (b.level === 1) { n1++; n2 = 0; out.push((n1 <= ROMAN.length ? ROMAN[n1 - 1] : String(n1)) + ". " + t.toUpperCase()); }
            else if (b.level === 2) { n2++; out.push(n2 + ". " + t); }
            else out.push(t);
        }
        return out;
    }
}
