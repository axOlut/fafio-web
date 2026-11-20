// Outils des champs de texte : formules LaTeX (aperçu en direct) et « + Insérer » (image, graphique, tableau).
import { inlineSpans, displayOf } from "../math.js";
import { mathBox, drawMath } from "../export/mathdraw.js";
import { OBJ, SEP } from "../rich.js";

const MARKER = /^\[\[(image|graphique|tableau|chart|table|figure):([A-Za-z0-9_-]+)\]\]$/;

function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
        else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
        if (c == null || c === false) continue;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
}

/** Boutons de la formule : [libellé, texte inséré]. « ‸ » = position du curseur. */
const KEYS = [
    ["a/b", "\\frac{‸}{}"], ["√", "\\sqrt{‸}"], ["xⁿ", "^{‸}"], ["xₙ", "_{‸}"], ["∑", "\\sum_{i=1}^{n} ‸"], ["∫", "\\int_{a}^{b} ‸ \\,dx"],
    ["lim", "\\lim_{x \\to ‸}"], ["vec", "\\vec{‸}"], ["x̄", "\\bar{‸}"], ["( )", "\\left( ‸ \\right)"],
    ["α", "\\alpha "], ["β", "\\beta "], ["γ", "\\gamma "], ["Δ", "\\Delta "], ["θ", "\\theta "], ["λ", "\\lambda "], ["μ", "\\mu "],
    ["π", "\\pi "], ["σ", "\\sigma "], ["ω", "\\omega "], ["Ω", "\\Omega "], ["×", "\\times "], ["·", "\\cdot "], ["±", "\\pm "],
    ["≤", "\\leq "], ["≥", "\\geq "], ["≠", "\\neq "], ["≈", "\\approx "], ["→", "\\to "], ["∞", "\\infty "], ["°", "^{\\circ}"],
    ["( a b )", "\\begin{pmatrix} ‸ & \\\\  &  \\end{pmatrix}"], ["{ cas", "\\begin{cases} ‸ & \\\\  &  \\end{cases}"],
];

const newId = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

/** Enlève les délimiteurs d'une formule collée ($…$, $$…$$, \(…\), \[…\]). */
export function cleanTex(t) {
    let s = String(t || "").trim();
    for (const [a, b] of [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]]) {
        if (s.length > a.length + b.length && s.startsWith(a) && s.endsWith(b)) { s = s.slice(a.length, s.length - b.length).trim(); break; }
    }
    return s;
}

function insertAt(input, text) {
    const st = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? st;
    let caret = text.indexOf("‸");
    const clean = text.replace("‸", "");
    if (caret < 0) caret = clean.length;
    input.value = input.value.slice(0, st) + clean + input.value.slice(en);
    input.focus();
    input.setSelectionRange(st + caret, st + caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Insère un bloc seul sur sa ligne dans le grand champ. */
function insertLine(area, line) {
    const v = area.value;
    const st = area.selectionStart ?? v.length, en = area.selectionEnd ?? st;
    const before = v.slice(0, st), after = v.slice(en);
    const pre = before && !before.endsWith("\n") ? "\n" : "";
    const post = after && !after.startsWith("\n") ? "\n" : "";
    area.value = before + pre + line + post + after;
    const pos = (before + pre + line).length;
    area.setSelectionRange(pos, pos);
    area.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Petite image d'une formule. */
function formulaCanvas(tex, display, maxW = 520) {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    const size = display ? 18 : 16;
    let box;
    try { box = mathBox(ctx, tex, size, display); } catch (e) { return el("code", {}, tex); }
    const pad = 6, dpr = Math.min(3, window.devicePixelRatio || 1);
    const scale = Math.min(1, (maxW - 2 * pad) / Math.max(1, box.w));
    const w = (box.w * scale + 2 * pad), h = ((box.asc + box.desc) * scale + 2 * pad);
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.translate(pad, pad + box.asc * scale);
    ctx.scale(scale, scale);
    drawMath(ctx, box, 0, 0, getComputedStyle(document.body).color || "#111827");
    return cv;
}

function dialog(title, body, actions) {
    const back = el("div", { class: "dialog-back" });
    const box = el("div", { class: "dialog wide", role: "dialog" }, el("h3", {}, title), body, el("div", { class: "actions" }, actions));
    back.appendChild(box);
    back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);
    return back;
}

/**
 * Outils sous un champ de texte. env = { rich, values, setValue(k, v), s(key), tr(T), chartTypes, Images, toast }.
 * Renvoie un élément à placer sous le champ.
 */
export function richTools(area, env) {
    const { s } = env;
    const wrap = el("div", { class: "rich" });
    const bar = el("div", { class: "rich-bar" });
    const live = el("div", { class: "rich-live" });
    bar.appendChild(el("button", { type: "button", class: "chip tool", onClick: () => formulaDialog(area, env) }, s("tool_formula")));
    if (env.pro) bar.appendChild(el("button", { type: "button", class: "chip tool", onClick: () => aiDialog(area, env) }, s("ai_tool")));
    if (env.rich) {
        const menu = el("div", { class: "rich-menu hidden" });
        const item = (label, fn) => el("button", { type: "button", onClick: () => { menu.classList.add("hidden"); fn(); } }, label);
        menu.append(
            item(s("ins_formula"), () => formulaDialog(area, env, "", true)),
            item(s("ins_image"), () => imagePick(area, env)),
            item(s("ins_chart"), () => chartDialog(area, env)),
            item(s("ins_table"), () => tableDialog(area, env)));
        const btn = el("button", { type: "button", class: "chip tool", onClick: (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); } }, s("tool_insert"));
        document.addEventListener("click", () => menu.classList.add("hidden"));
        bar.append(el("div", { class: "rich-ins" }, btn, menu));
    }
    wrap.append(bar, live);
    let t = null;
    const refresh = () => renderLive(area, live, env);
    const grow = () => { area.rows = Math.min(14, Math.max(3, area.value.split("\n").length + 1)); };
    area.addEventListener("input", () => { grow(); clearTimeout(t); t = setTimeout(refresh, 250); });
    refresh();
    return wrap;
}

/** Aperçu sous le champ : formules rendues et objets insérés. */
function renderLive(area, live, env) {
    const { s } = env;
    const text = area.value || "";
    live.replaceChildren();
    const formulas = [];
    for (const line of text.split("\n")) {
        const tex = displayOf(line);
        if (tex != null) { formulas.push([tex, true]); continue; }
        for (const sp of inlineSpans(line)) formulas.push([line.slice(sp[2], sp[3]), line.charAt(sp[0] + 1) === "$"]);
    }
    if (formulas.length) {
        live.appendChild(el("div", { class: "small muted" }, s("formulas_in_text")));
        const row = el("div", { class: "rich-formulas" });
        for (const [tex, display] of formulas.slice(0, 12)) row.appendChild(el("div", { class: "rich-f" + (display ? " d" : "") }, formulaCanvas(tex, display, 300)));
        live.appendChild(row);
    }
    const objs = [];
    for (const line of text.split("\n")) {
        const m = MARKER.exec(line.trim());
        if (m) objs.push(m[2]);
    }
    if (objs.length) {
        live.appendChild(el("div", { class: "small muted", style: { marginTop: "6px" } }, s("inserted_items")));
        for (const id of objs) {
            const o = String(env.values[OBJ + id] || "").split(SEP);
            const kind = o[0] || "";
            const name = kind === "image" ? s("ins_image") : kind === "chart" ? s("ins_chart") : kind === "table" ? s("ins_table") : "?";
            const legend = kind === "table" ? o[1] : o[2];
            const edit = () => {
                if (kind === "chart") chartDialog(area, env, id);
                else if (kind === "table") tableDialog(area, env, id);
                else if (kind === "image") legendDialog(env, (o[2] || ""), (lg) => { env.setValue(OBJ + id, ["image", o[1] || "", lg].join(SEP)); renderLive(area, live, env); });
            };
            const remove = () => {
                area.value = area.value.split("\n").filter((l) => !(MARKER.exec(l.trim()) || [])[2] || MARKER.exec(l.trim())[2] !== id).join("\n");
                if (kind === "image" && o[1]) env.Images.remove(o[1]);
                env.setValue(OBJ + id, "");
                area.dispatchEvent(new Event("input", { bubbles: true }));
            };
            live.appendChild(el("div", { class: "rich-obj" },
                el("span", { class: "grow" }, el("b", {}, name), legend ? " — " + legend : ""),
                el("button", { type: "button", class: "chip tool", onClick: edit }, s("edit_action")),
                el("button", { type: "button", class: "chip tool danger-t", onClick: remove }, s("remove"))));
        }
    }
}

// ---------------------------------------------------------------- Formule

export function formulaDialog(area, env, initial = "", forceDisplay = false) {
    const { s } = env;
    const input = el("textarea", { class: "input mono", rows: "3", dir: "ltr", spellcheck: "false", autocapitalize: "off", autocomplete: "off" });
    input.value = initial;
    const keys = el("div", { class: "chips keys" }, KEYS.map(([label, ins]) => el("button", { type: "button", class: "chip key", onClick: () => insertAt(input, ins) }, label)));
    const view = el("div", { class: "rich-preview" });
    let display = forceDisplay;
    const modeDisplay = el("button", { type: "button", class: "chip" }, s("formula_display"));
    const modeInline = el("button", { type: "button", class: "chip" }, s("formula_inline"));
    const num = el("input", { type: "checkbox" });
    num.checked = true;
    const numRow = el("label", { class: "row small", style: { gap: "8px", marginTop: "6px" } }, num, s("formula_number"));
    const setMode = (d) => {
        display = d;
        modeDisplay.classList.toggle("on", d); modeInline.classList.toggle("on", !d);
        numRow.style.display = d ? "" : "none";
        draw();
    };
    modeDisplay.addEventListener("click", () => setMode(true));
    modeInline.addEventListener("click", () => setMode(false));
    const draw = () => {
        const tex = cleanTex(input.value);
        view.replaceChildren(tex ? formulaCanvas(tex, display, 480) : el("span", { class: "muted small" }, s("formula_empty")));
    };
    input.addEventListener("input", draw);
    input.addEventListener("paste", () => setTimeout(() => { const c = cleanTex(input.value); if (c !== input.value) { input.value = c; draw(); } }, 0));
    const body = el("div", {},
        el("div", { class: "small muted", style: { marginBottom: "8px" } }, s("formula_hint")),
        el("label", { class: "small" }, s("formula_latex")), input, keys,
        el("div", { class: "chips", style: { marginTop: "10px" } }, modeDisplay, modeInline), numRow,
        el("div", { class: "small muted", style: { marginTop: "10px" } }, s("formula_preview")), view);
    const back = dialog(s("formula_title"), body, [
        el("button", { onClick: () => back.remove() }, s("cancel")),
        el("button", {
            onClick: () => {
                const tex = cleanTex(input.value);
                if (!tex) { back.remove(); return; }
                if (display) insertLine(area, "$$" + tex + (num.checked ? "" : " \\nonumber") + "$$");
                else insertAt(area, "$" + tex + "$");
                back.remove();
            },
        }, s("insert_action")),
    ]);
    setMode(display);
    setTimeout(() => input.focus(), 50);
}

// ---------------------------------------------------------------- Image

function legendDialog(env, initial, onOk) {
    const { s } = env;
    const input = el("input", { class: "input", placeholder: s("legend_optional"), dir: "auto" });
    input.value = initial || "";
    const back = dialog(s("image_legend_title"), el("div", {}, input), [
        el("button", { onClick: () => back.remove() }, s("cancel")),
        el("button", { onClick: () => { onOk(input.value.trim()); back.remove(); } }, s("ok")),
    ]);
    setTimeout(() => input.focus(), 50);
}

function imagePick(area, env) {
    const file = el("input", { type: "file", accept: "image/*", class: "hidden" });
    file.addEventListener("change", async () => {
        const f = file.files && file.files[0];
        file.remove();
        if (!f) return;
        env.toast(env.s("importing"), 1500);
        let ref;
        try { ref = await env.Images.importFile(f); } catch (e) { env.toast(env.s("image_error")); return; }
        legendDialog(env, "", (lg) => {
            const id = newId("i");
            env.setValue(OBJ + id, ["image", ref, lg].join(SEP));
            insertLine(area, `[[image:${id}]]`);
        });
    });
    document.body.appendChild(file);
    file.click();
}

// ---------------------------------------------------------------- Graphique

function chartDialog(area, env, editId) {
    const { s, tr } = env;
    const o = editId ? String(env.values[OBJ + editId] || "").split(SEP) : ["chart", "0", "", "", "", ""];
    let type = parseInt(o[1] || "0", 10) || 0;
    const chips = el("div", { class: "chips" });
    const drawChips = () => chips.replaceChildren(...env.chartTypes.map((t, i) => el("button", { type: "button", class: "chip" + (i === type ? " on" : ""), onClick: () => { type = i; drawChips(); } }, tr(t))));
    drawChips();
    const legend = el("input", { class: "input", placeholder: s("legend_optional"), dir: "auto" }); legend.value = o[2] || "";
    const x = el("input", { class: "input", placeholder: s("axis_x"), dir: "auto" }); x.value = o[3] || "";
    const y = el("input", { class: "input", placeholder: s("axis_y"), dir: "auto" }); y.value = o[4] || "";
    const data = el("textarea", { class: "input", rows: "5", dir: "auto", placeholder: "0 ; 1,2\n1 ; 2,5\n2 ; 3,9" }); data.value = o[5] || "";
    const body = el("div", { class: "stack-s" },
        el("label", { class: "small" }, s("chart_type_label")), chips,
        legend, x, y, el("label", { class: "small" }, s("chart_data_label")), data);
    const back = dialog(s("ins_chart"), body, [
        el("button", { onClick: () => back.remove() }, s("cancel")),
        el("button", {
            onClick: () => {
                if (!data.value.trim()) { back.remove(); return; }
                const id = editId || newId("g");
                env.setValue(OBJ + id, ["chart", String(type), legend.value.trim(), x.value.trim(), y.value.trim(), data.value].join(SEP));
                if (!editId) insertLine(area, `[[graphique:${id}]]`);
                else area.dispatchEvent(new Event("input", { bubbles: true }));
                back.remove();
            },
        }, s(editId ? "save_action" : "insert_action")),
    ]);
}

// ---------------------------------------------------------------- Tableau

function tableDialog(area, env, editId) {
    const { s } = env;
    const o = editId ? String(env.values[OBJ + editId] || "").split(SEP) : ["table", "", "", "1"];
    const legend = el("input", { class: "input", placeholder: s("legend_optional"), dir: "auto" }); legend.value = o[1] || "";
    const data = el("textarea", { class: "input", rows: "6", dir: "auto", placeholder: "Grandeur ; Valeur ; Unité\nMasse ; 2,5 ; kg\nDurée ; 12 ; s" }); data.value = o[2] || "";
    const head = el("input", { type: "checkbox" }); head.checked = o[3] !== "0";
    const body = el("div", { class: "stack-s" }, legend, el("label", { class: "small" }, s("table_data_label")), data,
        el("label", { class: "row small", style: { gap: "8px" } }, head, s("table_header_row")));
    const back = dialog(s("ins_table"), body, [
        el("button", { onClick: () => back.remove() }, s("cancel")),
        el("button", {
            onClick: () => {
                if (!data.value.trim()) { back.remove(); return; }
                const id = editId || newId("t");
                env.setValue(OBJ + id, ["table", legend.value.trim(), data.value, head.checked ? "1" : "0"].join(SEP));
                if (!editId) insertLine(area, `[[tableau:${id}]]`);
                else area.dispatchEvent(new Event("input", { bubbles: true }));
                back.remove();
            },
        }, s(editId ? "save_action" : "insert_action")),
    ]);
}

// ---------------------------------------------------------------- Assistant de rédaction (IA)

const AI_TASKS = [["improve", "ai_improve"], ["fix", "ai_fix"], ["expand", "ai_expand"], ["summarize", "ai_summarize"], ["translate", "ai_translate"]];

function aiDialog(area, env) {
    const { s, pro } = env;
    const body = el("div", { class: "stack-s" });
    const text = area.value || "";
    const apply = (v) => { area.value = v; area.dispatchEvent(new Event("input", { bubbles: true })); back.remove(); };
    const menu = (err) => {
        if (!pro.online()) { body.replaceChildren(el("div", { class: "muted" }, s("pro_offline"))); return; }
        if (!text.trim()) { body.replaceChildren(el("div", { class: "muted" }, s("ai_empty"))); return; }
        body.replaceChildren(err ? el("div", { class: "small danger-t" }, err) : "",
            ...AI_TASKS.map(([task, key]) => el("button", { type: "button", class: "btn ghost", style: { width: "100%" }, onClick: () => run(task) }, s(key))));
    };
    const run = async (task) => {
        body.replaceChildren(el("div", { class: "row" }, el("div", { class: "spinner" }), el("span", {}, s("ai_working"))));
        try {
            const out = await pro.ai(task, text, env.lang);
            if (!out) { menu(""); return; }
            body.replaceChildren(el("div", { class: "rich-ai" }, out), el("div", { class: "small muted" }, s("ai_note")),
                el("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
                    el("button", { type: "button", class: "btn", onClick: () => apply(out) }, s("ai_replace")),
                    el("button", { type: "button", class: "btn soft", onClick: () => apply(text.trimEnd() + "\n" + out) }, s("ai_append"))));
        } catch (e) { menu(s("ai_error", e.message)); }
    };
    const back = dialog(s("ai_title"), body, [el("button", { onClick: () => back.remove() }, s("cancel"))]);
    menu("");
}
