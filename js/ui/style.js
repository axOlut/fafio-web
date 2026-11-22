// Réglages du style d'un document : thème (ou modèle de CV), couleur, taille du texte.
// Utilisés en haut du formulaire et dans l'aperçu (onglets Thème · Couleur · Taille).
import { themesFor, themeFor, primaryOf, PALETTE, parseColor } from "../forms/themes.js";
import { css } from "../export/canvasutil.js";

function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) e.style.setProperty(sk.startsWith("--") ? sk : sk.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), sv); }
        else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
}

/** Vignette d'un modèle de CV dessinée dans la couleur choisie. */
function cvThumb(model, color) {
    const c = css(color);
    const lines = (n, cls = "") => Array.from({ length: n }, (_, i) => el("i", { class: "ln " + cls, style: { width: i % 2 ? "70%" : "95%" } }));
    if (model === "band") return el("div", { class: "cvt band" },
        el("div", { class: "hd", style: { background: css(color, 30) } }, el("b", { class: "ph", style: { background: css(color, 150) } }), el("div", {}, el("i", { class: "nm" }), el("i", { class: "jb", style: { background: c } }))),
        ...[0, 1, 2].map(() => el("div", { class: "sec" }, el("div", { class: "tt" }, el("b", { class: "dot", style: { background: c } }), el("i", { class: "nm" })), ...lines(2))));
    if (model === "center") return el("div", { class: "cvt center" },
        el("b", { class: "ph", style: { background: css(color, 150) } }), el("i", { class: "nm big" }),
        ...[0, 1, 2].map(() => el("div", { class: "sec" }, el("i", { class: "rule" }), el("i", { class: "tt2", style: { background: c } }), ...lines(2))));
    const dark = model === "dark";
    return el("div", { class: "cvt sbar" },
        el("div", { class: "sb", style: { background: dark ? c : css(color, 22) } },
            el("b", { class: "ph", style: { background: dark ? "rgba(255,255,255,.6)" : css(color, 130) } }),
            ...[0, 1, 2].map(() => el("div", {}, el("i", { class: "bar", style: { background: dark ? "#fff" : c } }), ...lines(2, dark ? "w" : "")))),
        el("div", { class: "mn" }, el("i", { class: "nm" }),
            ...[0, 1, 2].map(() => el("div", {}, el("i", { class: "bar" + (dark ? " thin" : ""), style: { background: c } }), ...lines(3)))));
}

/** Rangée des thèmes (ou des modèles de CV). */
export function themeRow(type, data, onPick) {
    const cur = themeFor(type, data).id;
    const slides = type.module === "SLIDES", cv = type.id === "cv";
    const color = primaryOf(type, data);
    const row = el("div", { class: "themes" + (slides ? " wide" : "") }, themesFor(type).map((t) => {
        const th = el("div", { class: "th" });
        if (cv) th.appendChild(cvThumb(t.id.replace("cv_", ""), color));
        else if (t.hasCover || t.hasSlide) th.appendChild(el("img", { src: `assets/themes/${t.id}_${slides ? "sthumb" : "thumb"}.jpg`, alt: "", loading: "lazy" }));
        else th.appendChild(el("div", { class: "plain" }, el("i"), el("i"), el("i"), el("i", { style: { width: "70%" } }), el("i")));
        if (!cv) th.appendChild(el("div", { class: "dots" }, el("b", { style: { background: css(t.primary) } }), el("b", { style: { background: css(t.accent) } })));
        if (t.id === cur) th.appendChild(el("div", { class: "check" }, "✓"));
        return el("button", { type: "button", class: "theme" + (t.id === cur ? " on" : ""), style: { "--tc": css(cv ? color : t.primary) }, onClick: () => onPick(t.id) },
            th, el("div", { class: "nm" }, t.name.get ? t.name.get(document.documentElement.lang || "fr") : t.name));
    }));
    requestAnimationFrame(() => { const on = row.querySelector(".theme.on"); if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 16; });
    return row;
}

/** Pastilles de couleur : « Auto » (couleur du thème) puis la palette. */
export function colorRow(type, data, autoLabel, onPick) {
    const cur = (data.color || "").toUpperCase();
    const auto = themeFor(type, data).primary;
    const sw = (color, on, label, value) => el("button", { type: "button", class: "swatch" + (on ? " on" : ""), "aria-label": label || "#" + value,
        style: { "--sc": css(color) }, onClick: () => onPick(value) }, label ? el("span", {}, label) : on ? el("span", {}, "✓") : null);
    return el("div", { class: "swatches" }, sw(auto, cur === "", autoLabel, ""), ...PALETTE.map((hex) => sw(parseColor(hex), cur === hex, null, hex)));
}

/** Curseur de taille du texte (80 à 130 %). onInput pendant le glissement, onChange à la fin. */
export function sizeRow(data, onInput, onChange) {
    const val = el("span", { class: "sz-val" }, (data.scale || 100) + " %");
    const range = el("input", { type: "range", min: "80", max: "130", step: "5", value: String(data.scale || 100), class: "sz-range" });
    range.addEventListener("input", () => { val.textContent = range.value + " %"; if (onInput) onInput(+range.value); });
    range.addEventListener("change", () => onChange(+range.value));
    return el("div", { class: "sz" }, el("span", { class: "a1" }, "A"), range, el("span", { class: "a2" }, "A"), val);
}
