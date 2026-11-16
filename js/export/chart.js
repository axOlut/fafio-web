// Graphiques (courbe, barres, secteurs) dessinés en PNG haute définition (copie de ChartPainter.kt).
import { css } from "./canvasutil.js";

const W = 1600, H = 1000;
const PALETTE = [0x4F46E5, 0x0EA5E9, 0xF97316, 0x10B981, 0xA855F7, 0xEF4444, 0xEAB308, 0x14B8A6, 0xEC4899, 0x64748B];
const SANS = 'Inter, "Open Sans", Roboto, "Helvetica Neue", Arial, sans-serif';

export function dataUrlToBytes(url) {
    const b64 = url.slice(url.indexOf(",") + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Renvoie { png, width, height } ou null s'il n'y a aucune donnée. */
export function renderChart(spec) {
    if (!spec.points.length) return null;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    draw(c, spec);
    return { png: dataUrlToBytes(cv.toDataURL("image/png")), width: W, height: H };
}

function font(c, size, bold) { c.font = `${bold ? "700 " : ""}${size}px ${SANS}`; }

function text(c, s, x, y, { color = "#1F2937", size = 30, bold = false, align = "left" } = {}) {
    font(c, size, bold); c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
    c.fillText(s, x, y);
}

function ellipsize(c, s, maxW) {
    if (c.measureText(s).width <= maxW) return s;
    let t = s;
    while (t.length > 1 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}

export function fmt(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) < 1e12) return String(Math.round(v));
    return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function niceStep(raw) {
    if (raw <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * mag;
}

function draw(c, spec) {
    const ink = "#1F2937", muted = "#6B7280";
    if (spec.title.trim()) {
        font(c, 46, true);
        text(c, ellipsize(c, spec.title, W - 120), W / 2, 72, { color: ink, size: 46, bold: true, align: "center" });
    }
    if (spec.type === "PIE") pie(c, spec, ink, muted); else axes(c, spec, ink, muted);
}

function roundRect(c, x0, y0, x1, y1, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x0, y0, x1 - x0, y1 - y0, r); else c.rect(x0, y0, x1 - x0, y1 - y0);
}

function axes(c, spec, ink, muted) {
    const left = 170, right = W - 60, top = 120, bottom = H - 150;
    const values = spec.points.map((p) => p[1]);
    let lo = Math.min(0, ...values), hi = Math.max(0, ...values);
    if (hi === lo) hi = lo + 1;
    const step = niceStep((hi - lo) / 5);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const y = (v) => bottom - (v - lo) / (hi - lo) * (bottom - top);

    c.strokeStyle = "#E5E7EB"; c.lineWidth = 2;
    for (let v = lo; v <= hi + step / 2; v += step) {
        const yy = y(v);
        c.beginPath(); c.moveTo(left, yy); c.lineTo(right, yy); c.stroke();
        text(c, fmt(v), left - 16, yy + 10, { color: muted, size: 28, align: "right" });
    }
    c.strokeStyle = ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(left, top); c.lineTo(left, bottom); c.stroke();
    c.beginPath(); c.moveTo(left, y(0)); c.lineTo(right, y(0)); c.stroke();

    const n = spec.points.length;
    const num = (s) => { const v = Number(String(s).replace(",", ".")); return String(s).trim() !== "" && !isNaN(v) ? v : null; };
    const numericX = spec.points.every((p) => num(p[0]) != null) && spec.type === "LINE" && n > 1;
    let xs;
    if (numericX) {
        const xv = spec.points.map((p) => num(p[0]));
        const xmin = Math.min(...xv); let xmax = Math.max(...xv); if (xmax === xmin) xmax = xmin + 1;
        xs = xv.map((v) => left + 40 + ((v - xmin) / (xmax - xmin)) * (right - left - 80));
    } else {
        const slot = (right - left) / n;
        xs = spec.points.map((_, i) => left + slot * (i + 0.5));
    }
    font(c, 26, false);
    const maxLabel = (right - left) / n - 8;
    spec.points.forEach((p, i) => text(c, ellipsize(c, p[0], Math.max(maxLabel, 60)), xs[i], bottom + 40, { color: muted, size: 26, align: "center" }));

    const accent = css(spec.accent);
    if (spec.type === "BAR") {
        const slot = (right - left) / n;
        const bw = Math.min(slot * 0.6, 160);
        spec.points.forEach((p, i) => {
            const y0 = y(0), y1 = y(p[1]);
            c.fillStyle = accent;
            roundRect(c, xs[i] - bw / 2, Math.min(y0, y1), xs[i] + bw / 2, Math.max(y0, y1), 10); c.fill();
            text(c, fmt(p[1]), xs[i], p[1] >= 0 ? y1 - 14 : y1 + 34, { color: ink, size: 26, bold: true, align: "center" });
        });
    } else {
        c.beginPath();
        spec.points.forEach((p, i) => { if (i === 0) { c.moveTo(xs[i], y(0)); } c.lineTo(xs[i], y(p[1])); });
        c.lineTo(xs[xs.length - 1], y(0)); c.closePath();
        c.globalAlpha = 30 / 255; c.fillStyle = accent; c.fill(); c.globalAlpha = 1;
        c.beginPath();
        spec.points.forEach((p, i) => (i === 0 ? c.moveTo(xs[i], y(p[1])) : c.lineTo(xs[i], y(p[1]))));
        c.strokeStyle = accent; c.lineWidth = 7; c.lineJoin = "round"; c.lineCap = "round"; c.stroke();
        spec.points.forEach((p, i) => {
            c.fillStyle = accent; c.beginPath(); c.arc(xs[i], y(p[1]), 12, 0, 2 * Math.PI); c.fill();
            c.fillStyle = "#fff"; c.beginPath(); c.arc(xs[i], y(p[1]), 5, 0, 2 * Math.PI); c.fill();
            if (n <= 15) text(c, fmt(p[1]), xs[i], y(p[1]) - 24, { color: ink, size: 24, bold: true, align: "center" });
        });
    }
    if (spec.xLabel.trim()) text(c, spec.xLabel, (left + right) / 2, H - 50, { color: ink, size: 30, bold: true, align: "center" });
    if (spec.yLabel.trim()) {
        c.save(); c.translate(50, (top + bottom) / 2); c.rotate(-Math.PI / 2);
        text(c, spec.yLabel, 0, 10, { color: ink, size: 30, bold: true, align: "center" });
        c.restore();
    }
}

function pie(c, spec, ink, muted) {
    const pts = spec.points.filter((p) => p[1] > 0);
    const total = pts.reduce((s, p) => s + p[1], 0);
    if (total <= 0) return;
    const cx = 520, cy = 560, r = 360;
    let start = -Math.PI / 2;
    pts.forEach((p, i) => {
        const sweep = p[1] / total * 2 * Math.PI;
        c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, start, start + sweep); c.closePath();
        c.fillStyle = css(PALETTE[i % PALETTE.length]); c.fill();
        c.strokeStyle = "#fff"; c.lineWidth = 6; c.stroke();
        start += sweep;
    });
    const lx = 980;
    let ly = 260;
    const rowH = Math.min(70, 640 / Math.max(1, pts.length));
    pts.forEach((p, i) => {
        c.fillStyle = css(PALETTE[i % PALETTE.length]);
        roundRect(c, lx, ly - 26, lx + 34, ly + 8, 6); c.fill();
        font(c, 32, false);
        text(c, ellipsize(c, p[0], 400), lx + 52, ly, { color: ink, size: 32 });
        text(c, `${fmt(p[1] / total * 100)} %`, W - 200, ly, { color: muted, size: 30, bold: true });
        ly += rowH;
    });
}
