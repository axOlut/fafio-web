// Outils de dessin : couleurs, polices, mise en page du texte (équivalent de StaticLayout sur Android).

/** Couleur ARGB (entier) → couleur CSS. alpha optionnel (0..255). */
export function css(c, alpha) {
    const rgb = ((c >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0");
    if (alpha === undefined) return "#" + rgb;
    const r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
    return `rgba(${r},${g},${b},${(alpha / 255).toFixed(3)})`;
}

// ---------------------------------------------------------------- Polices

const SYSTEM = {
    times: '"Times New Roman", Times, "Liberation Serif", serif',
    arial: 'Arial, Helvetica, "Liberation Sans", sans-serif',
};
export const SERIF = SYSTEM.times;
export const SANS = 'Arial, Helvetica, "Liberation Sans", sans-serif';

/** Famille CSS d'une police FAFIO (les fichiers sont chargés par fonts.js). */
export function family(id, serif = false) {
    if (SYSTEM[id]) return SYSTEM[id];
    return `"F-${id}", ${serif ? SERIF : SANS}`;
}

/** Pinceau de texte. */
export function paint(size, { family: fam = SANS, bold = false, italic = false, color = "#1F2937", align = "left", underline = false, spacing = 0 } = {}) {
    return { size, family: fam, bold, italic, color, align, underline, spacing };
}

export function fontOf(p) {
    return `${p.italic ? "italic " : ""}${p.bold ? "700" : "400"} ${p.size}px ${p.family}`;
}

/** Mesure d'un texte avec un pinceau. */
export function measure(ctx, s, p) {
    ctx.font = fontOf(p);
    setSpacing(ctx, p);
    return ctx.measureText(s).width;
}

function setSpacing(ctx, p) {
    if ("letterSpacing" in ctx) ctx.letterSpacing = p.spacing ? `${p.spacing * p.size}px` : "0px";
}

/** Écrit une ligne de texte à la position de la ligne de base. */
export function drawText(ctx, s, x, y, p, rtl = false) {
    ctx.font = fontOf(p);
    setSpacing(ctx, p);
    ctx.fillStyle = p.color;
    ctx.textAlign = p.align;
    ctx.textBaseline = "alphabetic";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.fillText(s, x, y);
    if (p.underline) {
        const w = ctx.measureText(s).width;
        const x0 = p.align === "center" ? x - w / 2 : p.align === "right" ? x - w : x;
        ctx.fillRect(x0, y + p.size * 0.12, w, Math.max(0.5, p.size * 0.06));
    }
}

export function ellipsize(ctx, s, p, maxW) {
    if (measure(ctx, s, p) <= maxW) return s;
    let t = s;
    while (t.length > 1 && measure(ctx, t + "…", p) > maxW) t = t.slice(0, -1);
    return t + "…";
}

// ---------------------------------------------------------------- Mise en page

const ASC = 0.93, DESC = 0.24, MULT = 1.18;

/**
 * Coupe un texte (ou une liste de morceaux [{text, bold, underline}]) en lignes de largeur [width].
 * align : LEFT, CENTER, RIGHT, JUSTIFY. Renvoie un objet compatible avec l'usage de StaticLayout.
 */
export function layout(ctx, text, p, width, align = "LEFT", rtl = false) {
    width = Math.max(1, Math.floor(width));
    const runs = typeof text === "string" ? [{ text }] : text;
    const paras = [[]];
    for (const r of runs) {
        const rp = { ...p, bold: r.bold !== undefined ? r.bold : p.bold, underline: r.underline !== undefined ? r.underline : p.underline };
        const parts = String(r.text).split("\n");
        parts.forEach((part, i) => {
            if (i > 0) paras.push([]);
            const tokens = part.match(/\s+|[^\s]+/g) || [];
            for (const tk of tokens) paras[paras.length - 1].push({ text: tk, p: rp, space: /^\s+$/.test(tk) });
        });
    }
    const lines = [];
    for (const toks of paras) {
        let cur = [], w = 0;
        const push = (last) => {
            while (cur.length && cur[cur.length - 1].space) { w -= cur[cur.length - 1].w; cur.pop(); }
            lines.push({ toks: cur, width: Math.max(0, w), endOfPara: last });
            cur = []; w = 0;
        };
        for (const tk of toks) {
            tk.w = measure(ctx, tk.text, tk.p);
            if (tk.space && cur.length === 0) continue;
            if (w + tk.w > width && cur.length) {
                if (tk.space) { push(false); continue; }
                push(false);
            }
            if (!tk.space && tk.w > width) {
                // mot trop long : coupe caractère par caractère
                let chunk = "";
                for (const ch of tk.text) {
                    const cw = measure(ctx, chunk + ch, tk.p);
                    if (w + cw > width && chunk) {
                        cur.push({ text: chunk, p: tk.p, w: measure(ctx, chunk, tk.p) }); w += cur[cur.length - 1].w; push(false); chunk = ch;
                    } else chunk += ch;
                }
                if (chunk) { const c = { text: chunk, p: tk.p, w: measure(ctx, chunk, tk.p) }; cur.push(c); w += c.w; }
                continue;
            }
            cur.push(tk); w += tk.w;
        }
        push(true);
    }
    const lh = p.size * (ASC + DESC);
    let y = 0;
    lines.forEach((ln, i) => {
        ln.top = y;
        ln.baseline = y + p.size * ASC;
        const h = i === lines.length - 1 ? lh : lh * MULT;
        ln.bottom = y + h;
        y += h;
    });
    const L = {
        lines, width, height: y, lineCount: lines.length, align, rtl,
        getLineTop: (i) => lines[i].top,
        getLineBottom: (i) => lines[i].bottom,
        getLineBaseline: (i) => lines[i].baseline,
        getLineWidth: (i) => lines[i].width,
        draw(c, x, y0, fromLine = 0, toLine = lines.length) {
            for (let i = fromLine; i < toLine; i++) drawLine(c, lines[i], x, y0, width, align, rtl);
        },
    };
    return L;
}

function drawLine(c, ln, x, y0, width, align, rtl) {
    const base = y0 + ln.baseline;
    const justify = align === "JUSTIFY" && !ln.endOfPara;
    const spaces = ln.toks.filter((t) => t.space).length;
    const extra = justify && spaces ? (width - ln.width) / spaces : 0;
    let start;
    const normal = align === "LEFT" || align === "JUSTIFY";
    if (align === "CENTER") start = (width - ln.width) / 2;
    else if ((normal && !rtl) || (align === "RIGHT" && rtl)) start = 0;
    else start = width - ln.width;
    if (rtl) {
        // droite à gauche : on écrit les morceaux depuis la droite
        let cx;
        if (align === "CENTER") cx = x + (width + ln.width) / 2;
        else if (normal) cx = x + width;
        else cx = x + ln.width;
        for (const t of ln.toks) {
            const w = t.w + (t.space ? extra : 0);
            if (!t.space) drawText(c, t.text, cx, base, { ...t.p, align: "right" }, true);
            cx -= w;
        }
        return;
    }
    let cx = x + start;
    for (const t of ln.toks) {
        if (!t.space) drawText(c, t.text, cx, base, { ...t.p, align: "left" });
        else if (t.p.underline) { c.fillStyle = t.p.color; c.fillRect(cx, base + t.p.size * 0.12, t.w + extra, Math.max(0.5, t.p.size * 0.06)); }
        cx += t.w + (t.space ? extra : 0);
    }
}

// ---------------------------------------------------------------- Images

const decoded = new WeakMap();

/** Décode à l'avance toutes les images d'un document (le dessin est ensuite synchrone). */
export async function preloadImages(doc) {
    const list = [];
    const add = (data, type) => { if (data && !decoded.has(data)) list.push([data, type]); };
    for (const b of doc.blocks) if (b.type === "IMAGE") add(b.png, b.imgType);
    for (const s of doc.slides) add(s.png, s.imgType);
    if (doc.logoLeft) add(doc.logoLeft.data, doc.logoLeft.type);
    if (doc.logoRight) add(doc.logoRight.data, doc.logoRight.type);
    if (doc.theme.coverBg) add(doc.theme.coverBg.data, "jpeg");
    if (doc.theme.slideBg) add(doc.theme.slideBg.data, "jpeg");
    await Promise.all(list.map(async ([data, type]) => {
        try {
            const blob = new Blob([data], { type: type === "jpeg" ? "image/jpeg" : "image/png" });
            const img = await loadImage(blob);
            decoded.set(data, img);
        } catch (e) { /* image illisible : ignorée */ }
    }));
}

function loadImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}

export const imageOf = (data) => (data ? decoded.get(data) || null : null);

export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
}
