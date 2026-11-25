// CV dessiné selon l'un des 4 modèles : copie fidèle de CvPainter.kt (mêmes positions, en points).
// band (bandeau en haut), center (classique centré), dark (barre latérale foncée), light (barre latérale claire à bandeaux).
import { css, paint, measure, drawText, layout, imageOf } from "./canvasutil.js";
import { tint } from "../forms/themes.js";

const WHITE = 0xFFFFFFFF;
const INK = 0xFF1F2937, MUTED = 0xFF6B7280;

/**
 * Modèles à barre latérale : rubriques qui peuvent aller d'une colonne à l'autre.
 * Les coordonnées restent toujours sur le côté, les expériences toujours dans la partie principale.
 * Même logique dans CvPainter.kt (application Android) et dans le Word (docx.js).
 */
export const CV_MOVABLE = ["profile", "education", "skills", "languages", "interests", "references"];
const PREFER = { profile: "main", education: "main", skills: "side", languages: "side", interests: "side", references: "main" };
const SIDE_ORDER = ["profile", "education", "skills", "languages", "interests", "references"];
const MAIN_ORDER = ["profile", "experience", "education", "skills", "languages", "interests", "references"];

export class CvPainter {
    constructor(doc, pages, faces) {
        this.doc = doc; this.pages = pages; this.cv = doc.cv; this.faces = faces;
        this.pw = 595; this.ph = 842;
        this.p = doc.theme.primary; this.fs = doc.fontScale || 1; this.rtl = !!doc.rtl;
        this.model = this.cv.model;
        this.sidebar = this.model === "dark" || this.model === "light";
        this.sw = this.sidebar ? this.pw * 0.35 : 0;
        this.sideBg = this.model === "dark" ? this.p : tint(this.p, 0.95);
        this.sideInk = this.model === "dark" ? WHITE : INK;
        this.topY = 36; this.bottom = this.ph - 36;
        this.photo = this.cv.photo ? imageOf(this.cv.photo.data) : null;
        const { pw, sw, rtl, sidebar, model } = this;
        if (sidebar && !rtl) { this.sideX = 20; this.sideW = sw - 36; this.mainX = sw + 22; this.mainW = pw - sw - 22 - 28; }
        else if (sidebar) { this.sideX = pw - sw + 16; this.sideW = sw - 36; this.mainX = 28; this.mainW = pw - sw - 22 - 28; }
        else if (model === "center") { this.sideX = 0; this.sideW = 0; this.mainX = 48; this.mainW = pw - 96; }
        else { this.sideX = 0; this.sideW = 0; this.mainX = 36; this.mainW = pw - 72; }
        this.c = pages.dry ? pages.dryCtx : document.createElement("canvas").getContext("2d");
        this.place = this.sidebar ? (this.cv.place || this.computePlace()) : null;
    }

    // ------------------------------------------------------------------ Répartition entre les deux colonnes

    /** Hauteur occupée par une suite d'éléments (le premier écart ne compte pas). */
    heightOf(items) { return items.reduce((a, it, i) => a + it.h + (i ? it.gap : 0), 0); }

    /** Rubriques non vides du CV. */
    present(sec) {
        const cv = this.cv;
        if (sec === "profile" || sec === "references") return !!String(cv[sec] || "").trim();
        return (cv[sec] || []).length > 0;
    }

    /**
     * Choisit la colonne de chaque rubrique déplaçable : les choix de l'utilisateur (cv.prefs : side / main) sont respectés,
     * les autres (« auto ») sont répartis pour que les deux colonnes finissent à peu près à la même hauteur.
     * À égalité, chaque rubrique garde sa place habituelle.
     */
    computePlace() {
        const prefs = this.cv.prefs || {};
        const place = {};
        const secs = CV_MOVABLE.filter((s) => this.present(s));
        CV_MOVABLE.forEach((s) => { place[s] = prefs[s] === "side" || prefs[s] === "main" ? prefs[s] : PREFER[s]; });
        const auto = secs.filter((s) => prefs[s] !== "side" && prefs[s] !== "main");
        const blockH = (sec, side) => this.heightOf(this.section(sec, side, false)) + 16;
        const hSide = {}, hMain = {};
        secs.forEach((s) => { hSide[s] = blockH(s, true); hMain[s] = blockH(s, false); });
        const baseSide = this.heightOf(this.sideBase());
        const baseMain = this.heightOf(this.mainHead()) + (this.cv.experience.length ? this.heightOf(this.section("experience", false, true)) + 16 : 0);
        let best = null;
        for (let mask = 0; mask < 1 << auto.length; mask++) {
            const trial = { ...place };
            auto.forEach((s, i) => { trial[s] = mask & (1 << i) ? "side" : "main"; });
            let side = baseSide, main = baseMain, moved = 0;
            secs.forEach((s) => { if (trial[s] === "side") side += hSide[s]; else main += hMain[s]; });
            auto.forEach((s) => { if (trial[s] !== PREFER[s]) moved++; });
            const cost = Math.abs(side - main) + moved * 30;
            if (!best || cost < best.cost) best = { cost, trial };
        }
        return best ? best.trial : place;
    }

    tp(size, bold = false, color = INK, headFont = false, italic = false, spacing = 0) {
        const f = headFont ? this.faces.head : bold ? this.faces.bodyBold : this.faces.body;
        return paint(size * this.fs, { family: f.family, bold: headFont ? true : bold, italic, color: css(color), spacing });
    }
    lay(text, p, w, align = "LEFT") { return layout(this.c, text, p, w, align, this.rtl); }

    fillRect(c, x0, y0, x1, y1, color, alpha) { c.fillStyle = css(color, alpha); c.fillRect(x0, y0, x1 - x0, y1 - y0); }
    line(c, x0, y0, x1, y1, color, w, alpha) { c.strokeStyle = css(color, alpha); c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    dot(c, x, y, r, color) { c.fillStyle = css(color); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

    // ------------------------------------------------------------------ Dessin

    paint() {
        const headerH = this.model === "band" ? this.bandHeaderHeight() : 0;
        const side = this.sidebar ? this.sideItems() : [];
        const main = this.mainItems();
        const mainPl = this.paginate(main, (page) => (page === 1 && this.model === "band" ? headerH + 18 : this.topY));
        const sidePl = this.paginate(side, (page) => (page === 1 ? 28 : this.topY));
        const pages = Math.max(1, ...mainPl.map((x) => x[0]), ...sidePl.map((x) => x[0]));
        for (let n = 1; n <= pages; n++) {
            const c = this.pages.start();
            if (this.sidebar) this.fillRect(c, this.rtl ? this.pw - this.sw : 0, 0, this.rtl ? this.pw : this.sw, this.ph, this.sideBg);
            if (n === 1 && this.model === "band") this.drawBandHeader(c, headerH);
            side.forEach((it, i) => { if (sidePl[i][0] === n) it.draw(c, sidePl[i][1]); });
            main.forEach((it, i) => { if (mainPl[i][0] === n) it.draw(c, mainPl[i][1]); });
        }
        return pages;
    }

    paginate(items, start) {
        const out = [];
        let page = 1, y = start(1), atTop = true;
        items.forEach((it, i) => {
            if (!atTop) y += it.gap;
            let need = it.h;
            if (it.keep && i + 1 < items.length) need += items[i + 1].gap + items[i + 1].h;
            if (!atTop && y + need > this.bottom) { page++; y = start(page); }
            out.push([page, y]);
            y += it.h;
            atTop = false;
        });
        return out;
    }

    // ------------------------------------------------------------------ Éléments communs

    photoAt(c, cx, cy, d, ring, ringW, ringAlpha = 255) {
        if (!this.photo) return;
        const r = d / 2;
        c.save();
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
        c.drawImage(this.photo, cx - r, cy - r, d, d);
        c.restore();
        if (ring != null && ringW > 0) { c.strokeStyle = css(ring, ringAlpha); c.lineWidth = ringW; c.beginPath(); c.arc(cx, cy, r + ringW / 2, 0, Math.PI * 2); c.stroke(); }
    }

    icon(c, kind, x, mid, color) {
        const s = 7.5 * this.fs;
        c.save();
        c.fillStyle = css(color); c.strokeStyle = css(color); c.lineWidth = 0.8 * this.fs; c.lineJoin = "round"; c.lineCap = "round";
        if (kind === "loc") {
            const cx = x + s / 2, r = s * 0.32;
            c.beginPath(); c.arc(cx, mid - s * 0.15, r, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.moveTo(cx, mid + s / 2); c.lineTo(cx - r * 0.95, mid - s * 0.08); c.lineTo(cx + r * 0.95, mid - s * 0.08); c.closePath(); c.fill();
            c.fillStyle = "#fff"; c.beginPath(); c.arc(cx, mid - s * 0.15, r * 0.4, 0, Math.PI * 2); c.fill();
        } else if (kind === "mail") {
            const l = x, t = mid - s * 0.33, w = s, h = s * 0.66;
            c.strokeRect(l, t, w, h);
            c.beginPath(); c.moveTo(l, t); c.lineTo(l + w / 2, t + h / 2 + s * 0.05); c.lineTo(l + w, t); c.stroke();
        } else {
            const l = x + s * 0.22, t = mid - s / 2, w = s * 0.56, h = s, r = s * 0.12;
            c.beginPath(); c.moveTo(l + r, t); c.arcTo(l + w, t, l + w, t + h, r); c.arcTo(l + w, t + h, l, t + h, r); c.arcTo(l, t + h, l, t, r); c.arcTo(l, t, l + w, t, r); c.closePath(); c.stroke();
            c.beginPath(); c.arc(l + w / 2, t + h - s * 0.16, s * 0.06, 0, Math.PI * 2); c.fill();
        }
        c.restore();
    }

    contactsBlock(width, size, color, center) {
        const p = this.tp(size, false, color);
        const gap = 13 * this.fs, iw = 7.5 * this.fs + 4;
        const rows = []; let cur = [], w = 0;
        for (const ct of this.cv.contacts) {
            const itemW = iw + measure(this.c, ct[1], p);
            if (cur.length && w + gap + itemW > width) { rows.push(cur); cur = []; w = 0; }
            w += (cur.length ? gap : 0) + itemW;
            cur.push([ct, itemW]);
        }
        if (cur.length) rows.push(cur);
        const lineH = size * this.fs * 1.55;
        const draw = (c, x0, y0) => {
            rows.forEach((row, ri) => {
                const total = row.reduce((a, r) => a + r[1], 0) + gap * (row.length - 1);
                let x = center ? x0 + (width - total) / 2 : this.rtl ? x0 + width - total : x0;
                const base = y0 + ri * lineH + size * this.fs * 1.05;
                for (const [ct, itemW] of row) {
                    this.icon(c, ct[0], x, base - size * this.fs * 0.33, color);
                    drawText(c, ct[1], x + iw, base, { ...p, align: "left" });
                    x += itemW + gap;
                }
            });
        };
        return [rows.length * lineH, draw];
    }

    paraItem(text, x, w, p, gap, align = "LEFT") {
        const l = this.lay(text, p, w, align);
        return { h: l.height, gap, keep: false, draw: (c, y) => l.draw(c, x, y) };
    }

    bulletItems(list, x, w, color, dotColor, size = 9.5) {
        return list.map((s, i) => {
            const p = this.tp(size, false, color);
            const l = this.lay(s, p, w - 12);
            return { h: l.height, gap: i === 0 ? 4 : 2, keep: false, draw: (c, y) => {
                this.dot(c, this.rtl ? x + w - 3.5 : x + 3.5, y + p.size * 0.62, 1.5 * this.fs, dotColor);
                l.draw(c, this.rtl ? x : x + 12, y);
            } };
        });
    }

    titleItem(label, x, w, side, first) {
        const { model, rtl, p, pw, sw } = this;
        if (model === "band") {
            const tp = this.tp(12.5, true, INK);
            const l = this.lay(label, tp, w - 14);
            const h = l.height + 7;
            return { h, gap: first ? 0 : 14, keep: true, draw: (c, y) => {
                const cy = y + l.getLineBaseline(0) - tp.size * 0.33;
                this.dot(c, rtl ? x + w - 3 : x + 3, cy, 2.6 * this.fs, p);
                l.draw(c, rtl ? x : x + 14, y);
                this.line(c, rtl ? x : x + 14, y + h - 1, rtl ? x + w - 14 : x + w, y + h - 1, p, 0.7);
            } };
        }
        if (model === "center") {
            const tp = this.tp(12.5, true, p, false, false, 0.08);
            const l = this.lay(label, tp, w);
            const top = first ? 0 : 13;
            return { h: top + l.height + 6, gap: first ? 6 : 12, keep: true, draw: (c, y) => {
                if (!first) this.line(c, x, y, x + w, y, 0xFFD1D5DB, 0.8);
                l.draw(c, x, y + top);
            } };
        }
        if (model === "light") {
            const tp = this.tp(12.5, true, WHITE);
            const l = this.lay(label, tp, w - 16);
            const h = l.height + 8;
            return { h, gap: first ? 0 : 16, keep: true, draw: (c, y) => {
                const bx0 = side && rtl ? pw - sw : x;
                const bx1 = side && !rtl ? sw : x + w;
                this.fillRect(c, bx0, y, bx1, y + h, p);
                l.draw(c, rtl ? x : x + 8, y + 4);
            } };
        }
        const color = side ? WHITE : p;
        const tp = this.tp(13, true, color);
        const l = this.lay(label, tp, w);
        const h = l.height + 7;
        return { h, gap: first ? 0 : 16, keep: true, draw: (c, y) => {
            l.draw(c, x, y);
            const lx0 = side && rtl ? pw - sw : x;
            const lx1 = side ? (rtl ? x + w : sw) : x + w;
            if (side) this.line(c, lx0, y + h - 1, lx1, y + h - 1, WHITE, 0.8, 110);
            else this.line(c, lx0, y + h - 1, lx1, y + h - 1, 0xFFBDBDBD, 0.8);
        } };
    }

    entryItems(e, x, w, first, education) {
        const out = [];
        const gap = first ? 6 : 10;
        if (this.model === "band") {
            if (e.period) out.push(this.paraItem(e.period, x, w, this.tp(8.5, false, MUTED), gap));
            const runs = [{ text: e.title, bold: true }];
            if (e.org) runs.push({ text: " – " + e.org, bold: false, color: css(MUTED) });
            const l = this.lay(runs, this.tp(10.5), w);
            out.push({ h: l.height, gap: e.period ? 1 : gap, keep: false, draw: (c, y) => l.draw(c, x, y) });
        } else {
            const boldPeriod = this.model === "center";
            const pp = this.tp(9.5, boldPeriod, boldPeriod ? INK : MUTED);
            const pwid = e.period ? measure(this.c, e.period, pp) + 2 : 0;
            const tl = this.lay(e.title, this.tp(10.5, true), w - pwid - (pwid > 0 ? 10 : 0));
            const ol = e.org ? this.lay(e.org, this.tp(9.5, false, MUTED), w) : null;
            const h = tl.height + (ol ? ol.height : 0) + 1;
            out.push({ h, gap, keep: false, draw: (c, y) => {
                tl.draw(c, this.rtl ? x + pwid + (pwid > 0 ? 10 : 0) : x, y);
                if (pwid > 0) drawText(c, e.period, this.rtl ? x : x + w - pwid, y + tl.getLineBaseline(0), { ...pp, align: "left" });
                if (ol) ol.draw(c, x, y + tl.height + 1);
            } });
        }
        if (education && e.details) out.push(this.paraItem(e.details, x, w, this.tp(9.5, false, MUTED), 1));
        out.push(...this.bulletItems(e.bullets, x, w, INK, INK));
        return out;
    }

    gridItems(list, x, w, cols = 3) {
        const colW = w / cols, out = [];
        for (let i = 0; i < list.length; i += cols) {
            const ls = list.slice(i, i + cols).map((s) => this.lay(s, this.tp(9.5), colW - 14));
            const h = Math.max(...ls.map((l) => l.height));
            out.push({ h, gap: 4, keep: false, draw: (c, y) => {
                ls.forEach((l, k) => {
                    const cx = this.rtl ? x + w - (k + 1) * colW : x + k * colW;
                    this.dot(c, this.rtl ? cx + colW - 3.5 : cx + 3.5, y + 9.5 * this.fs * 0.62, 1.5 * this.fs, INK);
                    l.draw(c, this.rtl ? cx : cx + 12, y);
                });
            } });
        }
        return out;
    }

    // ------------------------------------------------------------------ Modèle « bandeau »

    bandTextX() { return this.photo && !this.rtl ? 36 + 96 + 20 : 36; }
    bandTextW() { return this.pw - 72 - (this.photo ? 96 + 20 : 0); }

    bandHeaderHeight() {
        const w = this.bandTextW();
        this.bandName = this.lay(this.cv.name, this.tp(22, true, INK, true), w);
        this.bandJob = this.cv.job ? this.lay(this.cv.job, this.tp(12, false, 0xFF4B5563), w) : null;
        this.bandContacts = this.cv.contacts.length ? this.contactsBlock(w, 9, INK, false) : null;
        const textH = this.bandName.height + (this.bandJob ? this.bandJob.height + 4 : 0) + 10 + (this.bandContacts ? this.bandContacts[0] : 0);
        return Math.max(this.photo ? 96 : 0, textH) + 52;
    }

    drawBandHeader(c, h) {
        this.fillRect(c, 0, 0, this.pw, h, tint(this.p, 0.94));
        if (this.photo) this.photoAt(c, this.rtl ? this.pw - 36 - 48 : 36 + 48, h / 2, 96, this.p, 1.6);
        const x = this.bandTextX(), w = this.bandTextW();
        const textH = this.bandName.height + (this.bandJob ? this.bandJob.height + 4 : 0) + 10 + (this.bandContacts ? this.bandContacts[0] : 0);
        let y = (h - textH) / 2;
        this.bandName.draw(c, x, y); y += this.bandName.height;
        if (this.bandJob) { y += 4; this.bandJob.draw(c, x, y); y += this.bandJob.height; }
        y += 5;
        this.line(c, x, y, x + w, y, this.p, 0.7);
        y += 5;
        if (this.bandContacts) this.bandContacts[1](c, x, y);
    }

    // ------------------------------------------------------------------ Colonnes

    /** Haut de la colonne de côté : photo et coordonnées (toujours sur le côté). */
    sideBase() {
        const out = [], cv = this.cv, x = this.sideX, w = this.sideW;
        if (this.photo) {
            const d = 118;
            out.push({ h: d + 22, gap: 0, keep: false, draw: (c, y) => {
                const cx = this.rtl ? this.pw - this.sw / 2 : this.sw / 2;
                if (this.model === "dark") this.photoAt(c, cx, y + d / 2 + 6, d, WHITE, 6, 70); else this.photoAt(c, cx, y + d / 2 + 6, d, null, 0);
            } });
        }
        if (cv.contacts.length) {
            out.push(this.titleItem(cv.lContact, x, w, true, !this.photo));
            cv.contacts.forEach((ct, i) => {
                const p = this.tp(9, false, this.sideInk);
                const l = this.lay(ct[1], p, w - 14);
                out.push({ h: l.height, gap: i === 0 ? 6 : 3, keep: false, draw: (c, y) => {
                    this.icon(c, ct[0], this.rtl ? x + w - 8 * this.fs : x, y + l.getLineBaseline(0) - p.size * 0.33, this.sideInk);
                    l.draw(c, this.rtl ? x : x + 14, y);
                } });
            });
        }
        return out;
    }

    /** Une rubrique (titre compris), dessinée pour la colonne de côté (side) ou la partie principale. */
    section(sec, side, first) {
        const cv = this.cv, model = this.model;
        const label = { profile: cv.lProfile, education: cv.lEducation, skills: cv.lSkills, languages: cv.lLanguages,
            interests: cv.lInterests, references: cv.lReferences, experience: cv.lExperience }[sec];
        if (side) {
            const x = this.sideX, w = this.sideW, ink = this.sideInk;
            const dotColor = model === "dark" ? WHITE : this.p;
            const out = [this.titleItem(label, x, w, true, first)];
            if (sec === "profile" || sec === "references") out.push(this.paraItem(cv[sec], x, w, this.tp(9.5, false, ink), 6));
            else if (sec === "education") cv.education.forEach((e, i) => out.push(...this.sideEntryItems(e, x, w, i === 0)));
            else out.push(...this.bulletItems(cv[sec], x, w, ink, dotColor, 9.5));
            return out;
        }
        const x = model === "band" ? this.mainX + 14 : this.mainX, w = model === "band" ? this.mainW - 14 : this.mainW;
        const out = [this.titleItem(label, this.mainX, this.mainW, false, first)];
        const body = this.tp(9.5);
        if (sec === "profile" || sec === "references") out.push(this.paraItem(cv[sec], x, w, body, 5));
        else if (sec === "experience") cv.experience.forEach((e, i) => out.push(...this.entryItems(e, x, w, i === 0, false)));
        else if (sec === "education") cv.education.forEach((e, i) => out.push(...this.entryItems(e, x, w, i === 0, true)));
        else if (model === "center") out.push(...this.gridItems(cv[sec], x, w));
        else if (this.sidebar && sec === "skills") out.push(...this.gridItems(cv[sec], x, w, 2));
        else out.push(this.paraItem(cv[sec].join("   |   "), x, w, body, 5));
        return out;
    }

    /** Formation dans la colonne de côté : titre, établissement et années les uns sous les autres. */
    sideEntryItems(e, x, w, first) {
        const ink = this.sideInk, soft = this.model === "dark" ? 0xFFDDE4F0 : MUTED;
        const out = [this.paraItem(e.title, x, w, this.tp(10, true, ink), first ? 6 : 10)];
        if (e.org) out.push(this.paraItem(e.org, x, w, this.tp(9, false, soft), 1));
        if (e.period) out.push(this.paraItem(e.period, x, w, this.tp(9, false, soft), 1));
        if (e.details) out.push(this.paraItem(e.details, x, w, this.tp(9, false, soft), 1));
        e.bullets.forEach((b) => out.push(this.paraItem("• " + b, x, w, this.tp(9, false, ink), 1)));
        return out;
    }

    sideItems() {
        const out = this.sideBase();
        let first = out.length === 0;
        for (const sec of SIDE_ORDER) {
            if (this.place[sec] !== "side" || !this.present(sec)) continue;
            out.push(...this.section(sec, true, first)); first = false;
        }
        return out;
    }

    /** En-tête de la partie principale (nom, poste ; ou bloc centré). */
    mainHead() {
        const out = [], cv = this.cv, model = this.model;
        const x = model === "band" ? this.mainX + 14 : this.mainX, w = model === "band" ? this.mainW - 14 : this.mainW;
        if (model === "center") {
            const d = 84;
            const nl = this.lay(cv.name, this.tp(26, true, INK, true), w, "CENTER");
            const jl = cv.job ? this.lay(cv.job, this.tp(13.5, false, 0xFF4B5563), w, "CENTER") : null;
            const ctb = cv.contacts.length ? this.contactsBlock(w, 9, 0xFF374151, true) : null;
            const h = (this.photo ? d + 12 : 0) + nl.height + (jl ? jl.height + 4 : 0) + (ctb ? ctb[0] + 10 : 0) + 14;
            out.push({ h, gap: 0, keep: false, draw: (c, y) => {
                let yy = y;
                if (this.photo) { this.photoAt(c, x + w / 2, yy + d / 2, d, null, 0); yy += d + 12; }
                nl.draw(c, x, yy); yy += nl.height;
                if (jl) { yy += 4; jl.draw(c, x, yy); yy += jl.height; }
                if (ctb) { yy += 10; ctb[1](c, x, yy); yy += ctb[0]; }
                yy += 12;
                this.line(c, x, yy, x + w, yy, 0xFFD1D5DB, 0.8);
            } });
        } else if (model === "dark" || model === "light") {
            const nl = this.lay(cv.name, this.tp(25, true, INK, true), w);
            const jl = cv.job ? this.lay(cv.job, this.tp(13.5, false, 0xFF4B5563), w) : null;
            out.push({ h: nl.height + (jl ? jl.height + 3 : 0) + 6, gap: 0, keep: false, draw: (c, y) => {
                nl.draw(c, x, y);
                if (jl) jl.draw(c, x, y + nl.height + 3);
            } });
        }
        return out;
    }

    mainItems() {
        const out = this.mainHead();
        let first = this.model !== "dark" && this.model !== "light";
        const order = this.sidebar ? MAIN_ORDER : ["profile", "skills", "experience", "education", "languages", "interests", "references"];
        for (const sec of order) {
            if (sec !== "experience" && !this.present(sec)) continue;
            if (sec === "experience" && !this.cv.experience.length) continue;
            if (this.sidebar && sec !== "experience" && this.place[sec] !== "main") continue;
            out.push(...this.section(sec, false, first)); first = false;
        }
        return out;
    }
}
