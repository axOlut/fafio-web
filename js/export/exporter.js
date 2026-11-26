// Transforme un formulaire rempli en vrais fichiers (PDF, Word, PowerPoint, image). Copie de Exporter.kt + Figures.kt.
import { Block, Slide, Img, DocTheme } from "../doc.js";
import { writeDocx } from "../docx.js";
import { writePptx } from "../pptx.js";
import { buildFrom, chartSpec } from "../forms/catalog.js";
import { Form } from "../forms/model.js";
import { themeFor, font as fontSpec, parseColor, tint } from "../forms/themes.js";
import { renderChart } from "./chart.js";
import { renderDoc, toPdf, cvPlace } from "./pdf.js";
import { CV_MOVABLE } from "./cv.js";
import { ensureFont, fontBytes, assetBytes, assetText } from "./fonts.js";
import { Images, imageRefs } from "../data/storage.js";
import { compressZip } from "../util.js";
import { expand, linearize, SEP } from "../rich.js";

export const MIME = {
    PDF: "application/pdf",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    PNG: "image/png",
};
export const EXT = { PDF: "pdf", DOCX: "docx", PPTX: "pptx", PNG: "png" };

const ctxFor = (lang, charts = true) => ({ lang, chart: (spec) => (charts ? renderChart(spec) : null) });

/** Titres des sections du document (pour choisir où placer une image). */
export function sections(type, data, lang) {
    try {
        const doc = buildFrom(type, data, ctxFor(lang, false));
        const list = doc.blocks.length === 0 && doc.slides.length
            ? doc.slides.filter((s) => !s.statement).map((s) => s.title.trim())
            : doc.blocks.filter((b) => b.type === "HEADING" && b.level === 1).map((b) => b.text.trim());
        return [...new Set(list.filter((x) => x))];
    } catch (e) { return []; }
}

/** Nom de fichier lisible tiré du document. */
export function fileName(type, data, lang, format) {
    const req = type.fields.find((f) => f.required);
    const first = req ? String((data.values || {})[req.id] || "").trim() : "";
    const base = first || type.title.get(lang);
    const clean = base.replace(/[\\/:*?"<>|\n\r\t]/g, " ").trim().replace(/\s+/g, "_").slice(0, 60);
    return `${clean || "FAFIO"}.${EXT[format]}`;
}

/** Thème complet (couleurs, styles, polices intégrables, fonds). */
async function theme(type, data, lang, forWord) {
    const spec = themeFor(type, data);
    const t = new DocTheme();
    Object.assign(t, {
        id: spec.id, primary: spec.primary, light: spec.light, accent: spec.accent, heading: spec.heading, pageNum: spec.pageNum,
        bullet: spec.bullet, runningHeader: spec.runningHeader, darkSlide: spec.darkSlide,
    });
    // Couleur choisie par-dessus le thème : titres, bandeaux, tableaux, filets
    const chosen = parseColor(data.color);
    if (chosen != null) { t.primary = chosen; t.light = tint(chosen, 0.93); t.accent = tint(chosen, 0.4); }
    const head = fontSpec(data.font || spec.headFont), body = fontSpec(data.font || spec.bodyFont);
    t.headFontId = head.id; t.bodyFontId = body.id; t.headFont = head.officeName; t.bodyFont = body.officeName;
    if (forWord) {
        if (!head.standard) [t.headFontR, t.headFontB] = await fontBytes(head.id);
        if (!body.standard) [t.bodyFontR, t.bodyFontB] = await fontBytes(body.id);
    }
    await Promise.all([ensureFont(head.id), ensureFont(body.id)]);
    if (spec.hasCover) { const b = await assetBytes(`assets/themes/${spec.id}_cover.jpg`); if (b) t.coverBg = new Img(b, 1240, 1754, "jpeg"); }
    if (spec.hasSlide) { const b = await assetBytes(`assets/themes/${spec.id}_slide.jpg`); if (b) t.slideBg = new Img(b, 1600, 900, "jpeg"); }
    if (lang === "en") { t.pageWord = "Page"; t.ofWord = "of"; }
    else if (lang === "ar") { t.pageWord = "صفحة"; t.ofWord = "من"; }
    else { t.pageWord = "Page"; t.ofWord = "sur"; }
    return t;
}

/** Photo de CV recadrée en carré (affichée ronde). */
async function squarePhoto(bytes) {
    const bmp = await createImageBitmap(new Blob([bytes]));
    const side = Math.min(bmp.width, bmp.height), out = Math.min(600, side);
    const cv = document.createElement("canvas");
    cv.width = out; cv.height = out;
    cv.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.88));
    return new Img(new Uint8Array(await blob.arrayBuffer()), out, out, "jpeg");
}

/** Construit le document complet, images comprises. */
export async function buildDoc(type, data, lang, forWord = false) {
    const doc = buildFrom(type, data, ctxFor(lang));
    expand(doc, data.values || {});
    doc.rtl = lang === "ar";
    doc.style = data.style || "MODERN";
    doc.theme = await theme(type, data, lang, forWord);
    doc.fontScale = Math.max(80, Math.min(130, data.scale || 100)) / 100;
    const images = new Map();
    for (const ref of imageRefs(data)) { const b = await Images.bytes(ref); if (b) images.set(ref, b); }
    if (doc.cv) {
        doc.cv.model = themeFor(type, data).id.replace("cv_", "");
        const ph = doc.cv.photoRef ? images.get(doc.cv.photoRef) : null;
        if (ph) doc.cv.photo = await squarePhoto(ph.data).catch(() => null);
        if (doc.cv.model === "dark" || doc.cv.model === "light") {
            // choix de l'utilisateur (Disposition) puis équilibrage automatique des deux colonnes
            const v = data.values || {};
            doc.cv.prefs = Object.fromEntries(CV_MOVABLE.map((k) => [k, v["place_" + k] || "auto"]));
            if (document.fonts) await document.fonts.ready;
            doc.cv.place = cvPlace(doc);
        }
    }
    applyFigures(doc, data, lang, images);
    return doc;
}

// ---------------------------------------------------------------- Figures

const word = (lang) => (lang === "ar" ? "الشكل" : "Figure");
const tableWord = (lang) => (lang === "en" ? "Table" : lang === "ar" ? "الجدول" : "Tableau");
const listTitle = { fig: { fr: "Aucune figure", en: "No figure", ar: "لا توجد أشكال" }, tab: { fr: "Aucun tableau", en: "No table", ar: "لا توجد جداول" } };

function caption(legend) {
    const b = Block.para("", "CENTER", false).setItalic().setMuted().size(9.5);
    b.legend = legend;
    return b;
}

export function parsePoints(text) {
    const out = [];
    for (const line of String(text || "").split("\n")) {
        const parts = line.split(/[;\t:]/).map((s) => s.trim()).filter((s) => s);
        if (parts.length < 2) continue;
        const y = Number(parts[1].replace(/ /g, "").replace(",", "."));
        if (parts[1] === "" || isNaN(y)) continue;
        out.push([parts[0], y]);
    }
    return out;
}

/** Graphique inséré dans un champ : « chart␟type␟légende␟axe x␟axe y␟données ». */
function chartImage(text, color) {
    const o = String(text || "").split(SEP);
    const points = parsePoints(o[5] || "");
    if (!points.length) return null;
    const type = { 1: "BAR", 2: "PIE", 3: "REG" }[o[1]] || "LINE";
    return renderChart({ type, title: "", xLabel: o[3] || "", yLabel: o[4] || "", points, accent: color });
}

function applyFigures(doc, data, lang, images) {
    // emplacements d'images des rubriques et graphiques insérés dans le texte
    for (let i = 0; i < doc.blocks.length;) {
        const b = doc.blocks[i];
        if (b.type === "CHART") {
            doc.blocks.splice(i, 1);
            const img = chartImage(b.text, doc.theme.primary);
            const blk = img ? Block.image(img.png, img.width, img.height, "png") : null;
            if (blk) { doc.blocks.splice(i, 0, blk, caption(b.legend || "")); i += 2; }
            continue;
        }
        if (b.type === "SLOT") {
            doc.blocks.splice(i, 1);
            const l = images.get(b.ref);
            const img = l ? Block.image(l.data, l.w, l.h, "jpeg") : null;
            if (img) { doc.blocks.splice(i, 0, img, caption(b.legend || "")); i += 2; }
            continue;
        }
        i++;
    }
    for (const s of doc.slides) {
        if (s.imageRef && s.imageRef.trim()) {
            const l = images.get(s.imageRef);
            if (!l) continue;
            s.png = l.data; s.pxW = l.w; s.pxH = l.h; s.imgType = "jpeg";
            if (s.legend == null) s.legend = "";
        }
    }
    const logo = (ref) => { const l = ref ? images.get(ref) : null; return l ? new Img(l.data, l.w, l.h, "jpeg") : null; };
    doc.logoLeft = logo(doc.logoLeftRef);
    doc.logoRight = logo(doc.logoRightRef);
    const slidesMode = doc.blocks.length === 0 && doc.slides.length > 0;
    for (const item of new Form(data).items("figures")) {
        const v = visual(item, doc.theme.primary, images);
        if (!v) continue;
        const legend = String(item.caption || "").trim(), after = String(item.after || "").trim();
        if (slidesMode) insertSlide(doc, v, legend, after); else insertBlocks(doc, v, legend, after);
    }
    let n = 0, nt = 0;
    const figs = [], tabs = [];
    for (const b of doc.blocks) {
        if (b.legend == null) continue;
        if (b.tableCaption) {
            nt++;
            b.text = b.legend ? `${tableWord(lang)} ${nt} : ${b.legend}` : `${tableWord(lang)} ${nt}`;
            tabs.push(b.text);
            continue;
        }
        n++;
        b.text = b.legend ? `${word(lang)} ${n} : ${b.legend}` : `${word(lang)} ${n}`;
        figs.push(b.text);
    }
    // listes des figures et des tableaux (mémoire)
    for (let i = 0; i < doc.blocks.length; i++) {
        const b = doc.blocks[i];
        if (b.type !== "LIST") continue;
        const items = b.text === "tab" ? tabs : figs;
        const l = lang === "en" || lang === "ar" ? lang : "fr";
        doc.blocks[i] = items.length ? Block.para(items.join("\n"), "LEFT", false) : Block.para(listTitle[b.text === "tab" ? "tab" : "fig"][l], "LEFT", false).setItalic().setMuted();
    }
    for (const s of doc.slides) {
        if (s.legend == null || !s.png) continue;
        n++;
        s.caption = s.legend ? `${word(lang)} ${n} : ${s.legend}` : `${word(lang)} ${n}`;
    }
}

function visual(item, color, images) {
    if ((item.kind || "0") === "1") {
        const points = parsePoints(item.data);
        if (!points.length) return null;
        const type = { 1: "BAR", 2: "PIE", 3: "REG" }[item.chart_type] || "LINE";
        const img = renderChart({ type, title: "", xLabel: item.x_label || "", yLabel: item.y_label || "", points, accent: color });
        return img ? { bytes: img.png, w: img.width, h: img.height, type: "png" } : null;
    }
    const l = images.get(item.image || "");
    return l ? { bytes: l.data, w: l.w, h: l.h, type: "jpeg" } : null;
}

function insertBlocks(doc, v, legendText, after) {
    const image = Block.image(v.bytes, v.w, v.h, v.type);
    if (!image) return;
    let index = doc.blocks.length;
    if (after) {
        const h = doc.blocks.findIndex((b) => b.type === "HEADING" && b.level >= 1 && b.text.trim() === after);
        if (h >= 0) {
            const level = doc.blocks[h].level;
            let k = h + 1;
            while (k < doc.blocks.length && !(doc.blocks[k].type === "HEADING" && doc.blocks[k].level >= 1 && doc.blocks[k].level <= level)) k++;
            index = k;
        }
    }
    doc.blocks.splice(index, 0, image, caption(legendText));
}

function insertSlide(doc, v, legend, after) {
    const s = new Slide(legend || "Figure", []);
    s.png = v.bytes; s.pxW = v.w; s.pxH = v.h; s.imgType = v.type; s.legend = legend; s.caption = " ";
    let index = doc.slides.findIndex((x) => !x.statement && x.title.trim() === after);
    index = index >= 0 ? index + 1 : -1;
    if (index < 0) {
        index = doc.slides.length;
        while (index > 0 && doc.slides[index - 1].statement) index--;
    } else {
        while (index < doc.slides.length && doc.slides[index].caption && doc.slides[index].bullets.length === 0) index++;
    }
    doc.slides.splice(index, 0, s);
}

// ---------------------------------------------------------------- Export

let pptxAssets = null;
async function templates() {
    if (pptxAssets) return pptxAssets;
    const names = ["theme1.xml", "slideMaster1.xml", "slideLayout1.xml", "presProps.xml", "viewProps.xml", "tableStyles.xml"];
    const out = {};
    for (const n of names) out["pptx/" + n] = await assetText("assets/pptx/" + n);
    pptxAssets = out;
    return out;
}

/** Produit le fichier demandé. Renvoie un Blob. */
/** Mention discrète en bas de chaque page des PDF gratuits (« Fait avec FAFIO »). */
function stamp(r, text) {
    for (const cv of r.pages) {
        const c = cv.getContext("2d");
        const k = cv.width / r.w;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0); // le canevas garde l'échelle du dessin : on revient aux pixels
        c.font = `${7.5 * k}px "Helvetica Neue", Arial, sans-serif`;
        c.fillStyle = "rgba(107,114,128,0.85)";
        c.textAlign = "center";
        c.textBaseline = "bottom";
        c.fillText(text, cv.width / 2, cv.height - 7 * k);
        c.restore();
    }
}

/** opts.mark : texte de la mention des PDF gratuits (absent pour un PDF payé). */
export async function exportFile(type, data, lang, format, opts = {}) {
    if (format === "PNG") {
        const img = renderChart(chartSpec(new Form(data)));
        if (!img) throw new Error("no data");
        return new Blob([img.png], { type: MIME.PNG });
    }
    const doc = await buildDoc(type, data, lang, format === "DOCX");
    let bytes;
    if (format === "DOCX") bytes = await compressZip(writeDocx(doc));
    else if (format === "PPTX") {
        if (!doc.slides.length) throw new Error("no slides");
        linearize(doc);
        bytes = await compressZip(writePptx(doc, await templates()));
    } else {
        const r = await renderDoc(doc, 2.5);
        if (opts.mark) stamp(r, opts.mark);
        bytes = await toPdf(r, doc.title || type.title.get(lang));
    }
    return new Blob([bytes], { type: MIME[format] });
}

/** Pages de l'aperçu (canevas). */
export async function preview(type, data, lang) {
    const doc = await buildDoc(type, data, lang, false);
    return renderDoc(doc, 1.6);
}
