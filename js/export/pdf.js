// Rendu des pages (documents A4, présentations 16:9) sur des canevas, puis assemblage en PDF.
// Copie fidèle de PdfExporter.kt (mêmes positions, en points).
import { lines as docLines } from "../doc.js";
import { css, family, SERIF, SANS, paint, measure, drawText, ellipsize, layout, preloadImages, imageOf, roundRect } from "./canvasutil.js";
import { font as fontSpec } from "../forms/themes.js";

const WHITE = 0xFFFFFF;

class Faces {
    constructor(theme) {
        const hs = fontSpec(theme.headFontId), bs = fontSpec(theme.bodyFontId);
        this.head = { family: family(theme.headFontId, hs.serif), bold: true };
        this.body = { family: family(theme.bodyFontId, bs.serif), bold: false };
        this.bodyBold = { family: family(theme.bodyFontId, bs.serif), bold: true };
    }
}

/** Suite de pages dessinées sur des canevas. dry = première passe (mesures seulement). */
class Pages {
    constructor(wPt, hPt, scale, dry) {
        this.w = wPt; this.h = hPt; this.scale = scale; this.dry = dry; this.list = [];
        if (dry) { const c = document.createElement("canvas"); c.width = 4; c.height = 4; this.dryCtx = c.getContext("2d"); }
    }
    start() {
        if (this.dry) { this.list.push(null); const c = this.dryCtx; c.setTransform(1, 0, 0, 1, 0, 0); return c; }
        const cv = document.createElement("canvas");
        cv.width = Math.round(this.w * this.scale); cv.height = Math.round(this.h * this.scale);
        const c = cv.getContext("2d");
        c.scale(this.scale, this.scale);
        c.fillStyle = "#fff"; c.fillRect(0, 0, this.w, this.h);
        this.list.push(cv);
        return c;
    }
}

/**
 * Dessine le document. Renvoie { pages: [canvas], w, h } (w, h en points).
 * scale = pixels par point (2 pour l'aperçu, 2.5 pour le PDF).
 */
export async function renderDoc(doc, scale = 2) {
    await preloadImages(doc);
    if (doc.blocks.length === 0 && doc.slides.length > 0) {
        const pages = new Pages(960, 540, scale, false);
        new SlidePainter(doc, pages).paint();
        return { pages: pages.list, w: 960, h: 540 };
    }
    let total = 0, known = new Map();
    if (doc.toc || doc.theme.pageNum === "OF") {
        const dry = new Pages(doc.landscape ? 842 : 595, doc.landscape ? 595 : 842, 1, true);
        const p = new PagePainter(doc, dry, 0, new Map());
        p.paint();
        total = p.pageNo; known = p.headingPages;
    }
    const pages = new Pages(doc.landscape ? 842 : 595, doc.landscape ? 595 : 842, scale, false);
    new PagePainter(doc, pages, total, known).paint();
    return { pages: pages.list, w: pages.w, h: pages.h };
}

// ================================================================== Documents A4

class PagePainter {
    constructor(doc, pages, totalPages, knownPages) {
        this.doc = doc; this.pages = pages; this.totalPages = totalPages; this.knownPages = knownPages;
        this.headingPages = new Map();
        const th = doc.theme;
        this.theme = th; this.lightColor = th.light; this.accent2 = th.accent; this.hasBg = th.coverBg != null;
        this.pw = doc.landscape ? 842 : 595; this.ph = doc.landscape ? 595 : 842;
        this.margin = doc.landscape ? 40 : 56;
        this.left = this.margin; this.contentW = this.pw - 2 * this.margin;
        this.top = this.margin + (th.runningHeader ? 10 : 0);
        this.bottom = this.ph - this.margin - 18;
        this.accent = th.primary; this.ink = 0x1F2937; this.muted = 0x6B7280;
        this.fonts = new Faces(th);
        this.c = null; this.y = this.top; this.pageNo = 0; this.numbered = false; this.open = false;
        this.labels = []; this.current = -1;
    }

    paint() {
        const d = this.doc;
        if (d.cover) {
            if (d.coverModel === "EXPOSE") this.coverExpose();
            else if (d.coverModel === "TP") this.coverTp();
            else this.cover();
            if (d.pageBorder) this.pageBorder();
        }
        this.labels = d.headingLabels();
        if (d.toc) this.tocPage();
        this.newPage(true);
        d.blocks.forEach((b, i) => { this.current = i; this.block(b); });
        this.finish();
    }

    newPage(showNumber = true) {
        this.finish();
        this.pageNo++;
        this.c = this.pages.start();
        this.open = true;
        this.y = this.top;
        this.numbered = showNumber;
    }

    finish() {
        if (!this.open) return;
        if (this.numbered) {
            this.drawFooter();
            if (this.theme.runningHeader && this.doc.title.trim()) {
                const hp = this.tp(7.5, false, true, 0x7F7F7F);
                hp.align = this.doc.rtl ? "left" : "right";
                const hy = this.margin * 0.55;
                drawText(this.c, ellipsize(this.c, this.doc.title, hp, this.contentW), this.doc.rtl ? this.left : this.left + this.contentW, hy, hp, this.doc.rtl);
                this.line(this.left, hy + 5, this.left + this.contentW, hy + 5, this.accent, 0.6);
            }
        }
        this.open = false;
    }

    // -------------------------------------------------------- Primitives
    line(x0, y0, x1, y1, color, width, dash) {
        const c = this.c;
        c.save(); c.strokeStyle = css(color); c.lineWidth = width; if (dash) c.setLineDash(dash);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
    }
    rect(x0, y0, x1, y1, color, alpha) { this.c.fillStyle = css(color, alpha); this.c.fillRect(x0, y0, x1 - x0, y1 - y0); }
    strokeRect(x0, y0, x1, y1, color, width) { const c = this.c; c.strokeStyle = css(color); c.lineWidth = width; c.strokeRect(x0, y0, x1 - x0, y1 - y0); }
    rrect(x0, y0, x1, y1, r, color, alpha) { const c = this.c; roundRect(c, x0, y0, x1 - x0, y1 - y0, r); c.fillStyle = css(color, alpha); c.fill(); }
    rrectStroke(x0, y0, x1, y1, r, color, width, alpha) { const c = this.c; roundRect(c, x0, y0, x1 - x0, y1 - y0, r); c.strokeStyle = css(color, alpha); c.lineWidth = width; c.stroke(); }

    tp(size, bold, italic, color, face) {
        if (face) return paint(size, { family: face.family, bold: face.bold, italic, color: css(color) });
        return paint(size, { family: this.fonts.body.family, bold, italic, color: css(color) });
    }
    plain(size, bold, color = this.ink, face = null, underline = false) {
        if (face) return paint(size, { family: face.family || face, bold: face.bold !== undefined ? face.bold : bold, color: css(color), underline });
        return paint(size, { family: SERIF, bold, color: css(color), underline });
    }
    layout(text, p, width, align) { return layout(this.c, text, p, width, align, this.doc.rtl); }
    drawAt(l, x, yy) { l.draw(this.c, x, yy); }

    ensure(h) { if (this.y + h > this.bottom) this.newPage(); }

    /** Dessine un bloc de texte en le coupant entre les pages si nécessaire. */
    drawSplit(l, x) {
        let line = 0;
        while (line < l.lineCount) {
            const avail = this.bottom - this.y;
            let end = line;
            while (end < l.lineCount && l.getLineBottom(end) - l.getLineTop(line) <= avail) end++;
            if (end === line) { this.newPage(); continue; }
            const topPx = l.getLineTop(line), botPx = l.getLineBottom(end - 1);
            l.draw(this.c, x, this.y - topPx, line, end);
            this.y += botPx - topPx;
            line = end;
            if (line < l.lineCount) this.newPage();
        }
    }

    drawImage(data, x0, y0, x1, y1) {
        const img = imageOf(data);
        if (!img || this.pages.dry) return;
        this.c.drawImage(img, x0, y0, x1 - x0, y1 - y0);
    }

    // -------------------------------------------------------- Pagination
    drawFooter() {
        const { c, theme, left, contentW, pw, ph, margin } = this;
        const yy = ph - margin / 2;
        const n = String(this.pageNo);
        switch (theme.pageNum) {
            case "PIPE": {
                this.line(left, yy - 12, left + contentW, yy - 12, 0xD9D9D9, 0.6);
                const num = this.tp(8.5, true, false, this.ink);
                drawText(c, n, left, yy, num);
                const rest = this.tp(8.5, false, false, 0x7F7F7F); rest.spacing = 0.15;
                drawText(c, ` | ${theme.pageWord}`, left + measure(c, n, num), yy, rest);
                break;
            }
            case "OF": {
                const txt = this.totalPages > 0 ? `${theme.pageWord} ${n} ${theme.ofWord} ${this.totalPages}` : `${theme.pageWord} ${n}`;
                const p = this.tp(8.5, false, false, 0x6B7280); p.align = "right";
                drawText(c, txt, left + contentW, yy, p);
                break;
            }
            case "CIRCLE": {
                const cx = left + contentW - 9;
                c.fillStyle = css(this.accent); c.beginPath(); c.arc(cx, yy - 3, 10, 0, 2 * Math.PI); c.fill();
                const p = this.tp(8.5, true, false, WHITE); p.align = "center";
                drawText(c, n, cx, yy, p);
                break;
            }
            case "BAND": {
                this.rect(0, ph - 20, pw, ph, this.accent);
                const p = this.tp(8.5, true, false, WHITE); p.align = "center";
                drawText(c, n, pw / 2, ph - 7, p);
                break;
            }
            case "DASH": {
                const p = this.tp(9, false, false, this.accent); p.align = "center";
                drawText(c, `—  ${n}  —`, pw / 2, yy, p);
                break;
            }
            default: {
                const p = this.tp(8.5, false, false, 0x9CA3AF); p.align = "center";
                drawText(c, n, pw / 2, yy, p);
            }
        }
    }

    // -------------------------------------------------------- Cartes sur fond illustré
    drawCoverBg() { if (this.theme.coverBg) this.drawImage(this.theme.coverBg.data, 0, 0, this.pw, this.ph); }

    card(x, yy, w, h, framed = false) {
        this.rrect(x, yy, x + w, yy + h, 6, WHITE, 238);
        if (framed) {
            this.rrectStroke(x, yy, x + w, yy + h, 6, this.accent, 1.6);
            this.rrectStroke(x + 4, yy + 4, x + w - 4, yy + h - 4, 4, this.accent, 0.7);
        } else this.rrectStroke(x, yy, x + w, yy + h, 6, this.lightColor, 0.8);
    }

    // -------------------------------------------------------- Couvertures
    cover() {
        if (this.hasBg) { this.coverSimpleBg(); return; }
        this.newPage(false);
        const { doc, pw, ph, left, contentW, accent, ink } = this;
        if (doc.style === "ELEGANT") { this.rect(0, 0, pw, 26, accent); this.rect(0, ph - 26, pw, ph, accent); }
        else if (doc.style === "CLASSIC") { this.strokeRect(30, 30, pw - 30, ph - 30, ink, 1.5); this.strokeRect(36, 36, pw - 36, ph - 36, ink, 0.6); }
        else { this.rect(0, 0, 14, ph, accent); this.rect(14, ph * 0.62, pw, ph, accent, 0x14); }
        let yy = 90;
        if (doc.institution.trim()) { const l = this.layout(doc.institution.toUpperCase(), this.tp(11, true, false, ink), contentW, "CENTER"); this.drawAt(l, left, yy); }
        yy = ph * 0.30;
        const titleL = this.layout(doc.title, this.tp(26, true, false, accent, this.fonts.head), contentW - 20, "CENTER");
        this.drawAt(titleL, left + 10, yy); yy += titleL.height + 14;
        this.line(pw / 2 - 50, yy, pw / 2 + 50, yy, accent, 2); yy += 18;
        if (doc.subtitle.trim()) { const s = this.layout(doc.subtitle, this.tp(14, false, true, 0x4B5563), contentW, "CENTER"); this.drawAt(s, left, yy); }
        yy = ph * 0.66;
        for (const a of docLines(doc.author)) { const l = this.layout(a, this.tp(12.5, true, false, ink), contentW, "CENTER"); this.drawAt(l, left, yy); yy += l.height + 2; }
        yy += 6;
        for (const e of docLines(doc.extra)) { const l = this.layout(e, this.tp(10.5, false, true, 0x4B5563), contentW, "CENTER"); this.drawAt(l, left, yy); yy += l.height + 1; }
        if (doc.date.trim()) this.drawAt(this.layout(doc.date, this.tp(10.5, false, false, this.muted), contentW, "CENTER"), left, ph - 90);
    }

    coverSimpleBg() {
        this.newPage(false);
        this.drawCoverBg();
        const { doc, ph, left, contentW, accent, ink } = this;
        if (doc.institution.trim()) {
            const l = this.layout(doc.institution.toUpperCase(), this.tp(10.5, true, false, accent), contentW * 0.7 - 20, "CENTER");
            this.card(left + contentW * 0.15, 70, contentW * 0.7, l.height + 16);
            this.drawAt(l, left + contentW * 0.15 + 10, 78);
        }
        const tl = this.layout(doc.title, this.tp(24, true, false, accent, this.fonts.head), contentW * 0.82 - 36, "CENTER");
        const sl = doc.subtitle.trim() ? this.layout(doc.subtitle, this.tp(13, false, true, 0x4B5563), contentW * 0.82 - 36, "CENTER") : null;
        const h = tl.height + (sl ? sl.height + 10 : 0) + 40;
        const ty = ph * 0.36;
        this.card(left + contentW * 0.09, ty, contentW * 0.82, h, true);
        this.drawAt(tl, left + contentW * 0.09 + 18, ty + 20);
        if (sl) this.drawAt(sl, left + contentW * 0.09 + 18, ty + 30 + tl.height);
        const ls = [];
        docLines(doc.author).forEach((a) => ls.push([a, this.tp(12, true, false, ink)]));
        docLines(doc.extra).forEach((a) => ls.push([a, this.tp(10, false, true, 0x4B5563)]));
        if (doc.date.trim()) ls.push([doc.date, this.tp(10, false, false, accent)]);
        if (ls.length) {
            const lay = ls.map(([t, p]) => this.layout(t, p, contentW * 0.6 - 20, "CENTER"));
            const bh = lay.reduce((s, l) => s + l.height + 3, 0) + 18;
            const by = ph * 0.70;
            this.card(left + contentW * 0.2, by, contentW * 0.6, bh);
            let yy = by + 9;
            lay.forEach((l) => { this.drawAt(l, left + contentW * 0.2 + 10, yy); yy += l.height + 3; });
        }
    }

    measureColumn(text, w, size) {
        return text.split("\n").map((s) => s.trim()).filter((s) => s).reduce((sum, l) => {
            const stars = l.replace(/\*/g, "").trim() === "";
            return sum + this.layout(l, this.plain(stars ? 6 : size, false, this.ink, SANS), w, "CENTER").height;
        }, 0);
    }

    headerColumn(text, x, w, y0, size) {
        let yy = y0;
        for (const raw of text.split("\n")) {
            const l0 = raw.trim();
            if (!l0) continue;
            const stars = l0.replace(/\*/g, "").trim() === "";
            const l = this.layout(l0, this.plain(stars ? 6 : size, false, this.ink, SANS), w, "CENTER");
            this.drawAt(l, x, yy); yy += l.height;
        }
        return yy - y0;
    }

    drawLogo(img, cx, y0, maxW, maxH) {
        if (!img) return 0;
        const im = imageOf(img.data);
        const iw = im ? im.naturalWidth : img.w, ih = im ? im.naturalHeight : img.h;
        if (!iw || !ih) return 0;
        let w = maxW, h = w * ih / iw;
        if (h > maxH) { h = maxH; w = h * iw / ih; }
        this.drawImage(img.data, cx - w / 2, y0, cx + w / 2, y0 + h);
        return h;
    }

    centered(text, p, yy, width = this.contentW) {
        const l = this.layout(text, p, width, "CENTER");
        this.drawAt(l, this.left + (this.contentW - width) / 2, yy);
        return l.height;
    }

    coverExpose() {
        this.newPage(false);
        this.drawCoverBg();
        const { doc, ph, left, contentW, accent, hasBg } = this;
        const half = contentW / 2;
        let yy = 40;
        if (hasBg) {
            const hh = Math.max(this.measureColumn(doc.headerLeft, half - 6, 7.5), this.measureColumn(doc.headerRight, half - 6, 7.5))
                + (doc.logoLeft || doc.logoRight ? 72 : 0) + 16;
            this.card(left - 8, yy - 8, contentW + 16, hh);
        }
        const hl = this.headerColumn(doc.headerLeft, left, half - 6, yy, 7.5);
        const hr = this.headerColumn(doc.headerRight, left + half + 6, half - 6, yy, 7.5);
        yy += Math.max(hl, hr) + 8;
        const lh = Math.max(this.drawLogo(doc.logoLeft, left + half / 2, yy, 70, 62), this.drawLogo(doc.logoRight, left + half * 1.5, yy, 70, 62));
        yy = Math.max(yy + lh + 40, ph * 0.33);
        const themeText = doc.subtitle.trim() ? [{ text: doc.themeLabel, underline: true }, { text: " : " }, { text: doc.subtitle.toUpperCase(), bold: true }] : null;
        if (hasBg) {
            const tw = contentW * 0.86;
            const tl = this.layout(doc.title.toUpperCase(), this.plain(16, true, accent, this.fonts.head), tw - 36, "CENTER");
            const sl = themeText ? this.layout(themeText, this.plain(12, false), tw - 36, "CENTER") : null;
            const h = tl.height + (sl ? sl.height + 10 : 0) + 36;
            const x = left + (contentW - tw) / 2;
            this.card(x, yy, tw, h, true);
            this.drawAt(tl, x + 18, yy + 18);
            if (sl) this.drawAt(sl, x + 18, yy + 28 + tl.height);
            yy += h + 8;
        } else {
            yy += this.centered(doc.title.toUpperCase(), this.plain(15, true, this.ink, null, true), yy) + 12;
            if (themeText) yy += this.centered(themeText, this.plain(12, false), yy) + 10;
        }
        const useTable = doc.members.length > 0 && doc.memberHeader.length > 0;
        const people = useTable ? [] : docLines(doc.author), sups = docLines(doc.supervision);
        if (hasBg && (useTable || people.length || sups.length)) {
            let h = 16;
            if (useTable) h += 20 + this.membersTable(0, contentW, true) + 4;
            if (people.length) h += 20 + people.reduce((s, p) => s + this.layout("➢  " + p.toUpperCase(), this.plain(10.5, true), contentW - 14, "LEFT").height + 2, 0);
            if (sups.length) h += 24 + sups.length * 16;
            this.card(left - 8, yy + 18, contentW + 16, h);
        }
        if (people.length) {
            yy += 26;
            const lab = this.layout(doc.participantsLabel, this.plain(10.5, true, this.ink, null, true), contentW, "LEFT");
            this.drawAt(lab, left, yy); yy += lab.height + 8;
            for (const p of people) {
                const l = this.layout("➢  " + p.toUpperCase(), this.plain(10.5, true), contentW - 14, "LEFT");
                this.drawAt(l, left + 14, yy); yy += l.height + 2;
            }
        }
        if (useTable) {
            yy += 26;
            const lab = this.layout(doc.participantsLabel, this.plain(10.5, true, this.ink, null, true), contentW, "LEFT");
            this.drawAt(lab, left, yy); yy += lab.height + 8;
            yy += this.membersTable(yy, contentW);
        }
        if (sups.length) {
            yy += 24;
            const lp = this.plain(10.5, true, this.ink, null, true);
            const x0 = left + contentW * 0.28;
            const lw = measure(this.c, doc.supervisionLabel, lp);
            const sep = measure(this.c, " : ", this.plain(10.5, false));
            sups.forEach((sup, i) => {
                const base = yy + 12;
                if (i === 0) { drawText(this.c, doc.supervisionLabel, x0, base, lp); drawText(this.c, " : ", x0 + lw, base, this.plain(10.5, false)); }
                drawText(this.c, sup, x0 + lw + sep, base, this.plain(10.5, true));
                yy += 16;
            });
        }
        this.ribbon(doc.date, ph - 120);
    }

    darken(c) { const r = Math.floor(((c >> 16) & 0xFF) * 7 / 10), g = Math.floor(((c >> 8) & 0xFF) * 7 / 10), b = Math.floor((c & 0xFF) * 7 / 10); return (r << 16) | (g << 8) | b; }

    ribbon(text, top) {
        if (!text.trim()) return;
        const c = this.c;
        const light = this.theme.id === "modern" ? 0x5B9BD5 : this.accent;
        const dark = this.theme.id === "modern" ? 0x41719C : this.darken(this.accent);
        const cx = this.pw / 2, w = 150, h = 30;
        for (const sign of [-1, 1]) {
            const x1 = cx + sign * (w / 2 - 10), x2 = cx + sign * (w / 2 + 60);
            c.beginPath(); c.moveTo(x1, top + 8); c.lineTo(x2, top + 8); c.lineTo(x2 - sign * 18, top + 8 + h / 2); c.lineTo(x2, top + 8 + h); c.lineTo(x1, top + 8 + h); c.closePath();
            c.fillStyle = css(light); c.fill();
        }
        this.rect(cx - w / 2, top, cx + w / 2, top + h, light);
        this.rect(cx - w / 2, top + h, cx - w / 2 + 10, top + h + 8, dark);
        this.rect(cx + w / 2 - 10, top + h, cx + w / 2, top + h + 8, dark);
        drawText(c, text, cx, top + h / 2 + 5, paint(14, { family: SANS, bold: true, color: "#fff", align: "center" }));
    }

    /** Tableau NOM | PRÉNOM | MATRICULE. Renvoie la hauteur (dessine seulement si measureOnly est faux). */
    membersTable(yy, width, measureOnly = false) {
        const doc = this.doc;
        const cols = doc.memberHeader.length;
        if (!cols || !doc.members.length) return 0;
        const x0 = this.left + (this.contentW - width) / 2, colW = width / cols, pad = 4;
        let y0 = yy;
        [doc.memberHeader, ...doc.members].forEach((r, ri) => {
            const ls = Array.from({ length: cols }, (_, i) => this.layout(r[i] || "", this.plain(10.5, ri === 0), colW - 2 * pad, i === 0 && ri > 0 ? "LEFT" : "CENTER"));
            const h = Math.max(...ls.map((l) => l.height)) + 2 * pad;
            if (!measureOnly) for (let i = 0; i < cols; i++) {
                const x = doc.rtl ? x0 + width - (i + 1) * colW : x0 + i * colW;
                this.rect(x, y0, x + colW, y0 + h, ri === 0 ? this.lightColor : WHITE);
                this.strokeRect(x, y0, x + colW, y0 + h, this.ink, 0.7);
                this.drawAt(ls[i], x + pad, y0 + pad);
            }
            y0 += h;
        });
        return y0 - yy;
    }

    pageBorder() {
        const { pw, ph } = this;
        this.strokeRect(18, 18, pw - 18, ph - 18, this.accent, 3);
        this.strokeRect(24, 24, pw - 24, ph - 24, this.accent, 1);
    }

    /** Ruban (bannière enroulée) du titre. */
    scroll(x, y0, w, h, color) {
        const dark = this.darken(color);
        this.rrect(x - 6, y0 + 10, x + 16, y0 + h + 14, 11, dark);
        this.rrect(x + w - 16, y0 - 14, x + w + 6, y0 + h - 10, 11, dark);
        this.rrect(x + 4, y0, x + w - 4, y0 + h, 8, color);
        this.rrectStroke(x + 4, y0, x + w - 4, y0 + h, 8, dark, 1.2);
    }

    coverTp() {
        this.newPage(false);
        this.drawCoverBg();
        const { doc, ph, left, contentW, hasBg, ink } = this;
        const side = contentW * 0.38, mid = contentW - 2 * side;
        let yy = 40;
        if (hasBg) {
            const hh = Math.max(this.measureColumn(doc.headerLeft, side, 7), this.measureColumn(doc.headerRight, side, 7), 100) + 16;
            this.card(left - 8, yy - 8, contentW + 16, hh);
        }
        const hl = this.headerColumn(doc.headerLeft, left, side, yy, 7);
        const hr = this.headerColumn(doc.headerRight, left + side + mid, side, yy, 7);
        const lg = this.drawLogo(doc.logoLeft || doc.logoRight, left + side + mid / 2, yy + 6, mid - 10, 90);
        yy += Math.max(hl, hr, lg + 6) + 14;
        const labs = docLines(doc.institution);
        if (hasBg && labs.length) {
            const h = labs.reduce((s, l) => s + this.layout(l.toUpperCase(), this.plain(10.5, true), contentW, "CENTER").height + 2, 0) + 12;
            this.card(left + contentW * 0.05, yy - 6, contentW * 0.9, h);
        }
        for (const l of labs) yy += this.centered(l.toUpperCase(), this.plain(10.5, true), yy) + 2;
        yy += 24;
        let banner = docLines(doc.banner);
        if (!banner.length) banner = [doc.subtitle, doc.title].filter((x) => x.trim());
        const modern = this.theme.id === "modern";
        const boxW = contentW * 0.82, boxX = left + (contentW - boxW) / 2;
        const tl = this.layout(banner.map((x) => x.toUpperCase()).join("\n"), this.plain(13, true, WHITE, null, true), boxW - 44, "CENTER");
        const boxH = tl.height + 30;
        this.scroll(boxX, yy, boxW, boxH, modern ? 0x1F5F7F : this.accent);
        this.drawAt(tl, boxX + 22, yy + 15);
        yy += boxH + 24;
        if (doc.group.trim()) {
            if (hasBg) {
                const gh = this.layout(doc.group.toUpperCase(), this.plain(12, true), contentW, "CENTER").height + 12;
                this.card(left + contentW * 0.2, yy - 6, contentW * 0.6, gh);
            }
            yy += this.centered(doc.group.toUpperCase(), this.plain(12, true), yy) + 18;
        }
        const hasMembers = doc.members.length > 0 && doc.memberHeader.length > 0;
        const tableW = hasBg ? contentW * 0.92 : contentW;
        const infos = docLines(doc.infoLines);
        const sup = docLines(doc.supervision).join(", ");
        const supText = [{ text: doc.supervisionLabel + " : " }, { text: sup, bold: true }];
        const extras = docLines(doc.extra);
        if (hasBg && (hasMembers || infos.length || sup || extras.length)) {
            let h = 16;
            if (hasMembers) h += this.layout(doc.membersLabel, this.plain(10.5, true), contentW, "CENTER").height + 6 + this.membersTable(0, tableW, true) + 8;
            h += infos.reduce((s, l) => s + this.layout(l.toUpperCase(), this.plain(10.5, true), contentW - 20, "LEFT").height + 6, 0);
            if (sup) h += this.layout(supText, this.plain(13, false), contentW, "CENTER").height + 12;
            h += extras.reduce((s, l) => s + this.layout(l, this.plain(10.5, true), contentW, "CENTER").height + 4, 0);
            this.card(left - 8, yy - 8, contentW + 16, h);
        }
        if (hasMembers) {
            yy += this.centered(doc.membersLabel, this.plain(10.5, true), yy) + 6;
            yy += this.membersTable(yy, tableW) + 8;
        }
        for (const l of infos) { const t = this.layout(l.toUpperCase(), this.plain(10.5, true), contentW - 20, "LEFT"); this.drawAt(t, left + 10, yy); yy += t.height + 6; }
        if (sup) { yy += 12; yy += this.centered(supText, this.plain(13, false), yy); }
        for (const e of extras) yy += this.centered(e, this.plain(10.5, true), yy) + 4;
        if (doc.gradeBoxes) {
            yy += 26;
            const bw = (contentW - 30) / 2, bh = 95;
            drawText(this.c, doc.gradeLabel, left, yy, this.plain(10.5, false));
            drawText(this.c, doc.observationLabel, left + contentW, yy, { ...this.plain(10.5, false), align: "right" });
            yy += 8;
            for (const x of [left, left + contentW - bw]) { this.rect(x, yy, x + bw, yy + bh, WHITE); this.strokeRect(x, yy, x + bw, yy + bh, ink, 0.9); }
            yy += bh;
        }
        if (doc.date.trim()) {
            const txt = doc.yearLabel + " : " + doc.date;
            const p = { ...this.plain(12, true), align: "right" };
            const by = ph - 70;
            if (hasBg) { const tw = measure(this.c, txt, p); this.card(left + contentW - tw - 12, by - 18, tw + 20, 26); }
            drawText(this.c, txt, left + contentW, by, p);
        }
    }

    tocPage() {
        this.newPage(true);
        const { doc, left, contentW, accent, ink } = this;
        const t = this.layout(doc.tocTitle, this.tp(13, true, false, accent, this.fonts.head), contentW, "LEFT");
        this.drawAt(t, left, this.y); this.y += t.height + 8;
        this.line(left, this.y, left + contentW, this.y, this.accent2, 1);
        this.y += 16;
        doc.blocks.forEach((b, i) => {
            if (b.type !== "HEADING" || b.level < 1 || b.level > 2) return;
            const label = this.labels[i] || b.text;
            const indent = b.level === 1 ? 0 : 24;
            const num = this.knownPages.has(i) ? String(this.knownPages.get(i)) : "";
            const np = this.tp(10.5, b.level === 1, false, ink); np.align = doc.rtl ? "left" : "right";
            const numW = measure(this.c, num, np) + 8;
            const l = this.layout(label, this.tp(10.5, b.level === 1, false, ink), contentW - indent - numW - 30, "LEFT");
            this.ensure(l.height + 6);
            const baseline = this.y + l.getLineBaseline(l.lineCount - 1);
            if (doc.rtl) {
                this.drawAt(l, left + numW + 30, this.y);
                if (num) drawText(this.c, num, left, baseline, np, true);
            } else {
                this.drawAt(l, left + indent, this.y);
                if (num) {
                    const endText = left + indent + l.getLineWidth(l.lineCount - 1) + 6;
                    this.line(endText, baseline, left + contentW - numW, baseline, 0xB0B0B0, 0.8, [1, 3]);
                    drawText(this.c, num, left + contentW, baseline, np);
                }
            }
            this.y += l.height + (b.level === 1 ? 9 : 5);
        });
    }

    // -------------------------------------------------------- Blocs
    block(b) {
        switch (b.type) {
            case "HEADING": this.heading(b); break;
            case "PARAGRAPH": this.paragraph(b); break;
            case "BULLETS": case "NUMBERED": this.list(b); break;
            case "TABLE": this.table(b); break;
            case "IMAGE": this.image(b); break;
            case "FIELD": this.field(b); break;
            case "CHOICES": this.choices(b); break;
            case "SPACER": this.y += 10; break;
            case "PAGE_BREAK": this.newPage(); break;
            case "DIVIDER": this.ensure(10); this.y += 4; this.line(this.left, this.y, this.left + this.contentW, this.y, this.accent, 1); this.y += 10; break;
            default: break;
        }
    }

    heading(b) {
        const { left, contentW, accent } = this;
        if (b.level <= 0) {
            const size = b.sizePt > 0 ? b.sizePt : 20;
            const l = this.layout(b.text, this.tp(size, true, b.italic, accent, this.fonts.head), contentW, b.align);
            this.ensure(l.height + 30);
            this.y += 4;
            this.drawSplit(l, left);
            this.y += 10;
            return;
        }
        const label = this.labels[this.current] || b.text;
        if (b.level === 1) { this.heading1(label, b.align); return; }
        const [size, color] = b.level === 2 ? [12, accent] : [11, 0x4B5563];
        const l = this.layout(label, this.tp(size, true, false, color, this.fonts.bodyBold), contentW, b.align);
        this.y += 8;
        this.ensure(l.height + 46);
        if (this.current >= 0 && b.level === 2) this.headingPages.set(this.current, this.pageNo);
        this.drawSplit(l, left);
        this.y += 6;
    }

    heading1(label, align) {
        const { left, contentW, accent, doc } = this;
        const st = this.theme.heading;
        const size = 14.5;
        if (doc.breakBeforeH1 && this.y > this.top + 1) this.newPage();
        this.y += 14;
        const textColor = st === "BAND" ? WHITE : accent;
        let text = st === "CLASSIC" ? label.toUpperCase() : label;
        let badge = null;
        const dot = text.indexOf(". ");
        if (st === "BADGE" && dot >= 1 && dot <= 5) { badge = text.substring(0, dot); text = text.substring(dot + 2); }
        const padX = st === "BAND" || st === "BOXED" ? 8 : st === "LEFTBAR" ? 12 : 0;
        const hp = this.tp(size, true, false, WHITE, this.fonts.head);
        const badgeW = badge != null ? measure(this.c, badge, hp) + 16 : 0;
        const a = st === "CLASSIC" ? "CENTER" : align;
        const l = this.layout(text, this.tp(size, true, false, textColor, this.fonts.head), contentW - 2 * padX - badgeW - (badge != null ? 8 : 0), a);
        const boxed = st === "BAND" || st === "BOXED";
        const h = l.height + (boxed ? 10 : 0);
        this.ensure(h + 50);
        if (this.current >= 0) this.headingPages.set(this.current, this.pageNo);
        const y = this.y;
        if (st === "BAND") this.rect(left, y, left + contentW, y + h, accent);
        else if (st === "BOXED") { this.rrect(left, y, left + contentW, y + h, 4, this.lightColor); this.rrectStroke(left, y, left + contentW, y + h, 4, accent, 1); }
        else if (st === "LEFTBAR") { if (doc.rtl) this.rect(left + contentW - 4, y, left + contentW, y + h, accent); else this.rect(left, y, left + 4, y + h, accent); }
        else if (st === "CLASSIC") this.line(left + contentW * 0.25, y - 4, left + contentW * 0.75, y - 4, this.accent2, 0.7);
        let x = left + padX;
        if (badge != null) {
            const bh = l.getLineBottom(0) + 2;
            const bx = doc.rtl ? left + contentW - badgeW : left;
            this.rrect(bx, y - 1, bx + badgeW, y + bh, bh / 2, accent);
            const bp = { ...hp, align: "center" };
            drawText(this.c, badge, bx + badgeW / 2, y + l.getLineBaseline(0), bp);
            if (!doc.rtl) x = left + badgeW + 8;
        }
        this.drawAt(l, x, y + (boxed ? 5 : 0));
        this.y += h;
        if (st === "UNDERLINE") { this.y += 4; this.line(left, this.y, left + contentW, this.y, this.accent2, 1.2); this.y += 2; }
        else if (st === "CLASSIC") { this.y += 5; this.line(left + contentW * 0.25, this.y, left + contentW * 0.75, this.y, this.accent2, 0.7); }
        this.y += 9;
    }

    paragraph(b) {
        const color = b.accent ? this.accent : b.muted ? this.muted : this.ink;
        const size = b.sizePt > 0 ? b.sizePt : 10.5;
        for (const t of b.text.split("\n").map((s) => s.trim()).filter((s) => s)) {
            const l = this.layout(t, this.tp(size, b.bold, b.italic, color), this.contentW, b.align);
            this.drawSplit(l, this.left);
            this.y += 5;
        }
    }

    list(b) {
        const { left, contentW, doc } = this;
        const indent = 18;
        b.items.forEach((item, i) => {
            const l = this.layout(item, this.tp(10.5, false, false, this.ink), contentW - indent, "LEFT");
            this.ensure(Math.min(l.height, 30));
            const marker = b.type === "BULLETS" ? this.theme.bullet : `${i + 1}.`;
            const mp = this.tp(b.type === "BULLETS" ? 12 : 10.5, true, false, this.accent);
            const baseline = this.y + l.getLineBaseline(0);
            if (doc.rtl) { mp.align = "right"; drawText(this.c, marker, left + contentW, baseline, mp, true); this.drawSplit(l, left); }
            else { drawText(this.c, marker, left + 4, baseline, mp); this.drawSplit(l, left + indent); }
            this.y += 3;
        });
        this.y += 4;
    }

    table(b) {
        const { left, contentW, doc } = this;
        let cols = b.header.length;
        for (const r of b.rows) cols = Math.max(cols, r.length);
        if (cols === 0) return;
        const colW = contentW / cols, pad = 5, size = cols > 5 ? 8.5 : 9.5;
        const cells = (values, bold, color) => Array.from({ length: cols }, (_, i) => this.layout(values[i] || "", this.tp(size, bold, false, color), colW - 2 * pad, "LEFT"));
        const rowHeight = (ls) => Math.max(20, Math.max(...ls.map((l) => l.height)) + 2 * pad);
        const drawRow = (ls, h, bg, firstAccent = false) => {
            for (let i = 0; i < cols; i++) {
                const x = doc.rtl ? left + contentW - (i + 1) * colW : left + i * colW;
                if (firstAccent && i === 0) this.rect(x, this.y, x + colW, this.y + h, this.accent);
                else if (bg != null) this.rect(x, this.y, x + colW, this.y + h, bg);
                this.strokeRect(x, this.y, x + colW, this.y + h, 0xD1D5DB, 0.6);
                this.drawAt(ls[i], x + pad, this.y + pad);
            }
            this.y += h;
        };
        const header = b.header.length ? cells(b.header, true, WHITE) : null;
        const headerH = header ? rowHeight(header) : 0;
        this.y += 2;
        this.ensure(headerH + 22);
        if (header) drawRow(header, headerH, this.accent);
        b.rows.forEach((r, idx) => {
            const ls = b.rowHeader
                ? Array.from({ length: cols }, (_, i) => this.layout(r[i] || "", this.tp(size, i === 0, false, i === 0 ? WHITE : this.ink), colW - 2 * pad, i === 0 ? "LEFT" : "CENTER"))
                : cells(r, false, this.ink);
            const h = rowHeight(ls);
            if (this.y + h > this.bottom) { this.newPage(); if (header) drawRow(header, headerH, this.accent); }
            drawRow(ls, h, !b.rowHeader && idx % 2 === 1 ? this.lightColor : null, b.rowHeader);
        });
        this.y += 10;
    }

    image(b) {
        const im = imageOf(b.png);
        const iw = im ? im.naturalWidth : b.pxW, ih = im ? im.naturalHeight : b.pxH;
        if (!iw || !ih) return;
        let w = this.contentW, h = w * ih / iw;
        const maxH = this.ph * 0.45;
        if (h > maxH) { h = maxH; w = h * iw / ih; }
        this.ensure(h + 8);
        const x = this.left + (this.contentW - w) / 2;
        this.drawImage(b.png, x, this.y, x + w, this.y + h);
        this.y += h + 10;
    }

    field(b) {
        const { left, contentW, doc } = this;
        const label = `${b.text} :`;
        const tp = this.tp(10.5, true, false, this.ink);
        const rowH = 24;
        this.ensure(rowH * b.lines);
        const labelW = measure(this.c, label, tp);
        const baseline = this.y + 16;
        if (doc.rtl) {
            tp.align = "right"; drawText(this.c, label, left + contentW, baseline, tp, true);
            this.line(left, baseline + 2, left + contentW - labelW - 6, baseline + 2, 0x9CA3AF, 0.8, [1.2, 2.5]);
        } else {
            drawText(this.c, label, left, baseline, tp);
            this.line(left + labelW + 6, baseline + 2, left + contentW, baseline + 2, 0x9CA3AF, 0.8, [1.2, 2.5]);
        }
        this.y += rowH;
        for (let i = 1; i < b.lines; i++) { this.line(left, this.y + 18, left + contentW, this.y + 18, 0x9CA3AF, 0.8, [1.2, 2.5]); this.y += rowH; }
    }

    choices(b) {
        const { left, contentW, doc } = this;
        const q = this.layout(b.text, this.tp(10.5, true, false, this.ink), contentW, "LEFT");
        this.ensure(q.height + 40);
        this.y += 6;
        this.drawSplit(q, left);
        this.y += 4;
        if (!b.items.length) {
            for (let i = 0; i < 2; i++) { this.line(left, this.y + 18, left + contentW, this.y + 18, 0x9CA3AF, 0.8, [1.2, 2.5]); this.y += 24; }
            return;
        }
        for (const opt of b.items) {
            const l = this.layout(opt, this.tp(10.5, false, false, this.ink), contentW - 40, "LEFT");
            this.ensure(l.height + 4);
            const by = this.y + l.getLineBaseline(0) - 9;
            if (doc.rtl) { this.strokeRect(left + contentW - 28, by, left + contentW - 19, by + 9, 0x4B5563, 0.9); this.drawSplit(l, left); }
            else { this.strokeRect(left + 18, by, left + 27, by + 9, 0x4B5563, 0.9); this.drawSplit(l, left + 36); }
            this.y += 3;
        }
        this.y += 4;
    }
}

// ================================================================== Diapositives 16:9

class SlidePainter {
    constructor(doc, pages) {
        this.doc = doc; this.pages = pages; this.w = 960; this.h = 540;
        this.accent = doc.theme.primary; this.fonts = new Faces(doc.theme); this.n = 0;
        this.bg = doc.theme.slideBg ? imageOf(doc.theme.slideBg.data) : null;
    }
    start() { this.n++; return this.pages.start(); }
    tp(size, color, face, italic = false) { return paint(size, { family: face.family, bold: face.bold, italic, color: css(color) }); }
    lay(c, text, p, width, align) { return layout(c, text, p, width, align, this.doc.rtl); }
    drawBg(c) { if (!this.bg) return false; c.drawImage(this.bg, 0, 0, this.w, this.h); return true; }
    panel(c, x0, y0, x1, y1) {
        roundRect(c, x0, y0, x1 - x0, y1 - y0, 14); c.fillStyle = css(WHITE, 228); c.fill();
        roundRect(c, x0, y0, x1 - x0, y1 - y0, 14); c.strokeStyle = css(this.accent, 100); c.lineWidth = 1; c.stroke();
    }
    fill(c, color, alpha) { c.fillStyle = css(color, alpha); c.fillRect(0, 0, this.w, this.h); }

    paint() {
        this.titleSlide();
        this.doc.slides.forEach((s) => (s.statement ? this.statement(s) : this.content(s)));
    }

    titleSlide() {
        if (this.bg) { this.titleOnImage(); return; }
        const { doc, w, h, accent, fonts } = this;
        const c = this.start();
        this.fill(c, accent);
        c.fillStyle = css(WHITE, 60); c.fillRect(0, h - 30, w, 30);
        if (doc.institution.trim()) this.lay(c, doc.institution.toUpperCase(), this.tp(13, WHITE, fonts.bodyBold), w - 140, "LEFT").draw(c, 70, 50);
        c.fillStyle = "#fff"; c.fillRect(70, 180, 100, 6);
        const title = this.lay(c, doc.title, this.tp(38, WHITE, fonts.head), w - 140, "LEFT");
        title.draw(c, 70, 200);
        let y = 200 + title.height + 24;
        if (doc.subtitle.trim()) { const s = this.lay(c, doc.subtitle, this.tp(19, 0xE5E7EB, fonts.body, true), w - 140, "LEFT"); s.draw(c, 70, y); y += s.height + 10; }
        for (const a of docLines(doc.author)) { const s = this.lay(c, a, this.tp(15, WHITE, fonts.body), w - 140, "LEFT"); s.draw(c, 70, y); y += s.height + 2; }
        if (doc.date.trim()) this.lay(c, doc.date, this.tp(12, 0xE5E7EB, fonts.body), w - 140, "LEFT").draw(c, 70, y + 6);
    }

    titleOnImage() {
        const { doc, h, accent, fonts } = this;
        const c = this.start();
        this.drawBg(c);
        const r = { left: 52, top: 70, right: 52 + 590, bottom: h - 70 };
        this.panel(c, r.left, r.top, r.right, r.bottom);
        const x = r.left + 36, tw = r.right - r.left - 72;
        c.fillStyle = css(accent); c.fillRect(x, r.top + 34, 90, 5);
        let y = r.top + 56;
        if (doc.institution.trim()) { const l = this.lay(c, doc.institution.toUpperCase(), this.tp(11, accent, fonts.bodyBold), tw, "LEFT"); l.draw(c, x, y); y += l.height + 10; }
        const title = this.lay(c, doc.title, this.tp(doc.title.length > 60 ? 26 : 32, 0x111827, fonts.head), tw, "LEFT");
        title.draw(c, x, y); y += title.height + 12;
        if (doc.subtitle.trim()) this.lay(c, doc.subtitle, this.tp(16, 0x4B5563, fonts.body, true), tw, "LEFT").draw(c, x, y);
        const ls = [...docLines(doc.author), ...(doc.date.trim() ? [doc.date] : [])];
        let by = r.bottom - 30 - ls.length * 18;
        ls.forEach((a, i) => {
            const last = i === ls.length - 1 && doc.date.trim() !== "";
            this.lay(c, a, this.tp(13, last ? accent : 0x1F2937, last ? fonts.bodyBold : fonts.body), tw, "LEFT").draw(c, x, by);
            by += 18;
        });
    }

    statement(s) {
        const { doc, w, accent, fonts } = this;
        const c = this.start();
        this.fill(c, doc.style === "CLASSIC" ? WHITE : 0xF5F6FA);
        if (this.drawBg(c)) this.panel(c, 120, 160, w - 120, 390);
        c.fillStyle = css(accent); c.fillRect(w / 2 - 50, 200, 100, 6);
        this.lay(c, s.title, this.tp(34, accent, fonts.head), w - 160, "CENTER").draw(c, 80, 230);
    }

    slideTable(c, s, x0, y0, width) {
        const cols = s.tableHeader.length, colW = width / cols, size = s.tableRows.length > 8 ? 12 : 15;
        let y = y0;
        const rows = [s.tableHeader, ...s.tableRows];
        for (let ri = 0; ri < rows.length; ri++) {
            const r = rows[ri];
            const ls = Array.from({ length: cols }, (_, i) => this.lay(c, r[i] || "", this.tp(size, ri === 0 ? WHITE : 0x1F2937, ri === 0 ? this.fonts.bodyBold : this.fonts.body), colW - 12, "LEFT"));
            const rh = Math.max(...ls.map((l) => l.height)) + 12;
            if (y + rh > this.h - 40) return;
            for (let i = 0; i < cols; i++) {
                const x = this.doc.rtl ? x0 + width - (i + 1) * colW : x0 + i * colW;
                c.fillStyle = css(ri === 0 ? this.accent : ri % 2 === 0 ? this.doc.theme.light : WHITE);
                c.fillRect(x, y, colW, rh);
                c.strokeStyle = "#D1D5DB"; c.lineWidth = 0.8; c.strokeRect(x, y, colW, rh);
                ls[i].draw(c, x + 6, y + 6);
            }
            y += rh;
        }
    }

    content(s) {
        const { doc, w, h, accent, fonts } = this;
        const c = this.start();
        this.fill(c, WHITE);
        c.fillStyle = css(accent);
        if (this.drawBg(c)) this.panel(c, 30, 22, w - 30, h - 22);
        else if (doc.style === "MODERN") c.fillRect(0, 0, 14, h);
        else if (doc.style === "ELEGANT") c.fillRect(0, 0, w, 10);
        const left = 56;
        const title = this.lay(c, s.title, this.tp(28, accent, fonts.head, doc.style === "ELEGANT"), w - 2 * left, "LEFT");
        title.draw(c, left, 112 - title.height);
        c.fillStyle = css(accent); c.fillRect(left, 120, 80, 4);
        const img = s.png ? imageOf(s.png) : null;
        const hasImg = img != null;
        const textW = hasImg && s.bullets.length ? (w - 2 * left) / 2 - 16 : w - 2 * left;
        let y = 146;
        const size = s.bullets.length > 6 ? 15 : 17;
        for (const b of s.bullets) {
            const l = this.lay(c, b, this.tp(size, 0x1F2937, fonts.body), textW - 24, "LEFT");
            if (y + l.height > h - 50) break;
            const bp = this.tp(size + 2, accent, fonts.bodyBold);
            if (doc.rtl) { bp.align = "right"; drawText(c, doc.theme.bullet, left + textW, y + l.getLineBaseline(0), bp, true); l.draw(c, left, y); }
            else { drawText(c, doc.theme.bullet, left, y + l.getLineBaseline(0), bp); l.draw(c, left + 24, y); }
            y += l.height + 10;
        }
        if (s.tableRows.length && s.tableHeader.length) this.slideTable(c, s, left, y, w - 2 * left);
        if (hasImg) {
            const boxX = s.bullets.length ? left + textW + 32 : left;
            const boxW = s.bullets.length ? w - left - boxX : w - 2 * left;
            const boxY = 146, boxH = h - 196 - (s.caption ? 28 : 0);
            let iw = boxW, ih = iw * img.naturalHeight / img.naturalWidth;
            if (ih > boxH) { ih = boxH; iw = ih * img.naturalWidth / img.naturalHeight; }
            const x = boxX + (boxW - iw) / 2, yy = boxY + (boxH - ih) / 2;
            c.drawImage(img, x, yy, iw, ih);
            if (s.caption) this.lay(c, s.caption, this.tp(12, 0x4B5563, fonts.body, true), boxW, "CENTER").draw(c, boxX, yy + ih + 8);
        }
        drawText(c, String(this.n), w - 40, h - 24, { ...this.tp(11, 0x9CA3AF, fonts.body), align: "right" });
    }
}

// ================================================================== Assemblage PDF (pages en JPEG)

const enc = new TextEncoder();

async function canvasJpeg(cv, quality) {
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", quality));
    return new Uint8Array(await blob.arrayBuffer());
}

/** Construit un fichier PDF à partir des canevas rendus. */
export async function toPdf(rendered, title = "FAFIO", quality = 0.9) {
    const parts = [];
    let size = 0;
    const offsets = [];
    const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); size += b.length; };
    const obj = (n, body) => { offsets[n] = size; push(`${n} 0 obj\n`); for (const b of body) push(b); push("\nendobj\n"); };
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = rendered.pages.length;
    // 1 catalogue, 2 pages, 3 infos, puis pour chaque page : page, contenu, image
    const kids = [];
    for (let i = 0; i < n; i++) kids.push(`${4 + i * 3} 0 R`);
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, [`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${n} >>`]);
    const t = title.replace(/[()\\]/g, " ").replace(/[^\x20-\x7E]/g, "");
    obj(3, [`<< /Title (${t}) /Producer (FAFIO) /Creator (FAFIO) >>`]);
    for (let i = 0; i < n; i++) {
        const cv = rendered.pages[i];
        const jpg = await canvasJpeg(cv, quality);
        const pn = 4 + i * 3;
        const W = rendered.w, H = rendered.h;
        obj(pn, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${pn + 2} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${pn + 1} 0 R >>`]);
        const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
        obj(pn + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
        obj(pn + 2, [`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, "\nendstream"]);
    }
    const xref = size;
    const count = 4 + n * 3;
    let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    push(x);
    push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(size);
    let p = 0;
    for (const b of parts) { out.set(b, p); p += b.length; }
    return out;
}
