// FAFIO — version web (PWA) pour iPhone et tous les navigateurs. Mêmes écrans que l'application Android.
import "./util.js";
import { icon } from "./ui/icons.js";
import STR from "./i18n.js";
import { TYPES, MODULES, typeById, forModule, allowsImage, CHART_TYPES } from "./forms/catalog.js";
import { richTools } from "./ui/rich.js";
import * as Pro from "./data/pro.js";
import { blank, isVisible, imgKey, capKey, Form } from "./forms/model.js";
import { example } from "./forms/examples.js";
import { THEMES, FONTS, themeOf } from "./forms/themes.js";
import { columnsOn } from "./forms/science.js";
import { Drafts, Images, Settings } from "./data/storage.js";
import { exportFile, preview, sections, fileName, EXT, MIME } from "./export/exporter.js";
import { css } from "./export/canvasutil.js";
import { ensureFont } from "./export/fonts.js";

const VERSION = "1.0.0";
const CONTACT = { email: "infosaxolut@gmail.com", whatsapp: "237621659927", phone: "+237658809331" };
const ACCENT = { REPORTS: "#4F46E5", CV: "#0EA5E9", SLIDES: "#F97316", LETTERS: "#10B981", FORMS: "#A855F7", CHARTS: "#EF4444" };
const MOD_STR = { REPORTS: "reports", CV: "cv", SLIDES: "slides", LETTERS: "letters", FORMS: "forms", CHARTS: "charts" };

// ---------------------------------------------------------------- Langue et thème

function systemLang() {
    const l = (navigator.language || "fr").slice(0, 2);
    return l === "en" || l === "ar" ? l : "fr";
}
let lang = "fr";
function applyPrefs() {
    const pref = Settings.get("lang", "system");
    lang = pref === "system" ? systemLang() : pref;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = Settings.get("theme", "system");
}
const s = (key, ...args) => {
    let v = (STR[lang] && STR[lang][key]) || STR.fr[key] || key;
    args.forEach((a, i) => { v = v.replace(`%${i + 1}$s`, a).replace(`%${i + 1}$d`, a); });
    return v;
};
const tr = (t) => (t ? t.get(lang) : "");

// ---------------------------------------------------------------- Petit outil de rendu

function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "html") el.innerHTML = v;
        else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
        if (c == null || c === false) continue;
        el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    return el;
}

function topbar(title, onBack, extra) {
    return h("div", { class: "topbar" },
        onBack ? h("button", { class: "icon-btn flip", "aria-label": s("back"), onClick: onBack }, icon("back")) : null,
        h("h1", {}, title), extra || null);
}

function toast(msg, ms = 3200) {
    const t = h("div", { class: "toast", role: "status" }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
}

function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
        const back = h("div", { class: "dialog-back" });
        const close = (v) => { back.remove(); resolve(v); };
        back.appendChild(h("div", { class: "dialog", role: "dialog" },
            h("h3", {}, title), h("div", { class: "muted" }, text),
            h("div", { class: "actions" },
                h("button", { onClick: () => close(false) }, s("cancel")),
                h("button", { class: "danger", onClick: () => close(true) }, okLabel))));
        back.addEventListener("click", (e) => { if (e.target === back) close(false); });
        document.body.appendChild(back);
    });
}

const app = document.getElementById("app");

/** Menu fixe à gauche, visible seulement sur grand écran (ordinateur, tablette en paysage). */
function sidebar() {
    const cur = location.hash.replace(/^#\/?/, "") || "home";
    const item = (path, ic, label, color) => h("a", { class: "side-item" + (cur === path || cur.startsWith(path + "/") ? " on" : ""), href: "#/" + path },
        h("span", { class: "side-ic", style: color ? { color } : null }, icon(ic)), h("span", {}, label));
    return h("nav", { class: "side", "aria-label": "FAFIO" },
        h("a", { class: "side-brand", href: "#/home" }, h("img", { src: "img/logo_fafio.png", alt: "" }),
            h("div", {}, h("div", { class: "name" }, "FAFIO"), h("div", { class: "small muted" }, s("tagline")))),
        item("home", "report", s("side_home")),
        item("documents", "folder", s("my_documents")),
        h("div", { class: "side-label" }, s("what_to_create")),
        MODULES.map((m) => item("module/" + m.id, m.icon, s("mod_" + MOD_STR[m.id]), ACCENT[m.id])),
        h("div", { class: "side-grow" }),
        installButton(true),
        item("settings", "settings", s("settings")));
}

function mount(node, withSide = true) {
    app.replaceChildren(withSide ? h("div", { class: "shell" }, sidebar(), h("main", { class: "main" }, node)) : node);
    window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- Installation (Android, Windows, Mac, iPhone)

let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvt = e;
    document.querySelectorAll(".install-slot").forEach((el) => el.replaceWith(installButton(el.dataset.side === "1")));
});
window.addEventListener("appinstalled", () => {
    installEvt = null;
    document.querySelectorAll(".install-btn, .install-tip").forEach((el) => el.remove());
    toast(s("installed_ok"));
});

async function promptInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* rien */ }
    installEvt = null;
}

/** Bouton « Installer FAFIO » quand le navigateur le permet (Chrome, Edge sur Android et ordinateur). */
function installButton(side = false) {
    if (isStandalone() || !installEvt) return h("span", { class: "install-slot", "data-side": side ? "1" : "0" });
    return h("button", { class: side ? "side-install install-btn" : "btn install-btn", onClick: promptInstall }, icon("download"), s("install_app"));
}
const go = (path) => { location.hash = "#/" + path; };

// ---------------------------------------------------------------- Écrans

function welcome() {
    mount(h("div", { class: "welcome" },
        h("div", { class: "bg" }), h("div", { class: "veil" }),
        h("div", { class: "content" },
            h("div", { class: "w-title appear", style: { animationDelay: ".15s" } }, s("welcome_title")),
            h("div", { class: "w-brand appear", style: { animationDelay: ".35s" } }, "FAFIO"),
            h("div", { class: "w-slogan appear", style: { animationDelay: ".6s" } }, s("welcome_slogan")),
            h("div", { class: "spacer" }),
            h("button", { class: "btn big appear", style: { animationDelay: ".9s" }, onClick: () => { Settings.set("seen", "1"); go("home"); } }, s("welcome_start")))), false);
}

function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function installTip() {
    if (isStandalone() || Settings.get("tipClosed", "") === "1") return null;
    if (!isIos()) {
        const pc = !isMobile();
        const t = pc
            ? { fr: ["Installer FAFIO sur ton ordinateur", "FAFIO s'ouvrira dans sa propre fenêtre et marchera même sans Internet. Dans Chrome ou Edge : clique sur l'icône d'installation à droite de la barre d'adresse (ou menu ⋮ › « Installer FAFIO »)."],
                en: ["Install FAFIO on your computer", "FAFIO will open in its own window and work even offline. In Chrome or Edge: click the install icon at the right of the address bar (or menu ⋮ › “Install FAFIO”)."],
                ar: ["ثبّت FAFIO على حاسوبك", "سيفتح FAFIO في نافذته الخاصة ويعمل دون إنترنت. في كروم أو إيدج: انقر على أيقونة التثبيت يمين شريط العنوان (أو القائمة ⋮ › « تثبيت FAFIO »)."] }[lang]
            : { fr: ["Installer FAFIO sur ton téléphone", "FAFIO marchera comme une vraie application, même hors ligne. Menu du navigateur ⋮ › « Installer l'application » (ou « Ajouter à l'écran d'accueil »)."],
                en: ["Install FAFIO on your phone", "FAFIO will work like a real app, even offline. Browser menu ⋮ › “Install app” (or “Add to Home screen”)."],
                ar: ["ثبّت FAFIO على هاتفك", "سيعمل FAFIO كتطبيق حقيقي حتى دون اتصال. قائمة المتصفح ⋮ › « تثبيت التطبيق »."] }[lang];
        const tip = h("div", { class: "install-tip row" },
            h("div", { class: "grow" }, h("b", {}, t[0]), h("br"), t[1], h("div", { style: { marginTop: "10px" } }, installButton())),
            h("button", { class: "icon-btn", "aria-label": s("close"), onClick: () => { Settings.set("tipClosed", "1"); tip.remove(); } }, icon("close")));
        return tip;
    }
    const txt = {
        fr: ["Installer FAFIO sur ton iPhone", "Dans Safari, touche le bouton Partager", "puis « Sur l'écran d'accueil ». FAFIO marchera alors comme une vraie application, même hors ligne."],
        en: ["Install FAFIO on your iPhone", "In Safari, tap the Share button", "then “Add to Home Screen”. FAFIO will then work like a real app, even offline."],
        ar: ["ثبّت FAFIO على هاتفك", "في سفاري، اضغط زر المشاركة", "ثم « إضافة إلى الشاشة الرئيسية ». سيعمل FAFIO كتطبيق حقيقي حتى دون اتصال."],
    }[lang];
    const androidTxt = { fr: "Menu du navigateur ⋮ puis « Installer l'application ».", en: "Browser menu ⋮ then “Install app”.", ar: "قائمة المتصفح ⋮ ثم « تثبيت التطبيق »." }[lang];
    const tip = h("div", { class: "install-tip row" },
        h("div", { class: "grow" }, h("b", {}, txt[0]), h("br"),
            isIos() ? [txt[1], " ", h("span", { style: { display: "inline-block", width: "18px", verticalAlign: "-4px" } }, icon("share")), " ", txt[2]] : androidTxt),
        h("button", { class: "icon-btn", "aria-label": s("close"), onClick: () => { Settings.set("tipClosed", "1"); tip.remove(); } }, icon("close")));
    return tip;
}

function home() {
    const grid = h("div", { class: "grid" }, MODULES.map((m) => h("button", { class: "tile", onClick: () => go("module/" + m.id) },
        h("div", { class: "bubble", style: { background: ACCENT[m.id] + "1F", color: ACCENT[m.id] } }, icon(m.icon)),
        h("div", {}, h("div", { class: "t" }, s("mod_" + MOD_STR[m.id])), h("div", { class: "small muted" }, s("mod_" + MOD_STR[m.id] + "_sub"))))));
    mount(h("div", { class: "screen" }, h("div", { class: "scroll stack" },
        h("div", { class: "brandbar" },
            h("img", { src: "img/logo_fafio.png", alt: "" }),
            h("div", { class: "grow" }, h("div", { class: "name" }, "FAFIO"), h("div", { class: "small muted" }, s("tagline"))),
            h("button", { class: "icon-btn", "aria-label": s("settings"), onClick: () => go("settings") }, icon("settings"))),
        installTip(),
        h("div", { class: "hero" }, h("h2", {}, s("hero_hello")), h("p", {}, s("hero_text"))),
        h("button", { class: "list-item", onClick: () => go("documents") },
            h("div", { class: "bubble", style: { background: "var(--primary-soft)", color: "var(--on-primary-soft)" } }, icon("folder")),
            h("div", { class: "grow" }, h("div", { class: "title-m" }, s("my_documents")), h("div", { class: "small muted" }, s("my_documents_sub"))),
            icon("chevron", "chev")),
        h("div", { class: "title-l" }, s("what_to_create")),
        grid)));
}

function moduleScreen(id) {
    const m = MODULES.find((x) => x.id === id);
    if (!m) return go("home");
    const list = forModule(id).map((t) => h("button", { class: "list-item", onClick: () => startDraft(t) },
        h("div", { class: "bubble", style: { background: ACCENT[id] + "1F", color: ACCENT[id], width: "48px", height: "48px" } }, icon(m.icon)),
        h("div", { class: "grow" },
            h("div", { class: "title-m" }, tr(t.title)),
            h("div", { class: "small muted" }, tr(t.description)),
            h("div", { class: "small", style: { color: ACCENT[id], marginTop: "2px" } }, s("export_formats", t.formats.map((f) => EXT[f].toUpperCase()).join(" · ")))),
        icon("chevron", "chev")));
    mount(h("div", { class: "screen" }, topbar(s("mod_" + MOD_STR[id]), () => go("home")),
        h("div", { class: "scroll stack" }, h("div", { class: "muted" }, s("choose_doc_type")), list)));
}

async function startDraft(type) {
    const d = { id: Drafts.newId(), typeId: type.id, name: "", data: blank(type, lang), created: Date.now() };
    await Drafts.save(d);
    go("form/" + d.id);
}

async function documents() {
    const drafts = await Drafts.list();
    const body = h("div", { class: "scroll stack" });
    if (!drafts.length) body.appendChild(h("div", { class: "muted", style: { textAlign: "center", marginTop: "40px" } }, s("no_documents")));
    for (const d of drafts) {
        const type = typeById(d.typeId);
        if (!type) continue;
        const color = ACCENT[type.module];
        const m = MODULES.find((x) => x.id === type.module);
        const when = new Date(d.updated).toLocaleString(lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "fr-FR", { dateStyle: "medium", timeStyle: "short" });
        body.appendChild(h("div", { class: "list-item", role: "button", tabindex: "0", onClick: () => go("form/" + d.id) },
            h("div", { class: "bubble", style: { background: color + "1F", color } }, icon(m ? m.icon : "report")),
            h("div", { class: "grow" },
                h("div", { class: "title-m" }, d.name || s("untitled")),
                h("div", { class: "small muted" }, tr(type.title) + " · " + s("edited_on", when))),
            h("button", { class: "icon-btn", "aria-label": s("delete"), onClick: async (e) => {
                e.stopPropagation();
                if (await confirmDialog(s("delete_confirm"), s("delete_confirm_text"), s("delete"))) { await Drafts.remove(d.id); documents(); }
            } }, icon("delete"))));
    }
    mount(h("div", { class: "screen" }, topbar(s("my_documents"), () => go("home")), body));
}

// ---------------------------------------------------------------- Formulaire

async function formScreen(id) {
    const draft = await Drafts.get(id);
    const type = draft && typeById(draft.typeId);
    if (!type) return go("home");
    let data = draft.data;
    data.groups = data.groups || {};
    data.values = data.values || {};
    let timer = null;
    const nameOf = () => { const f = type.fields.find((x) => x.required); return f ? String(data.values[f.id] || "").trim() : ""; };
    const persist = () => { draft.data = data; draft.name = nameOf(); return Drafts.save(draft); };
    const changed = () => { clearTimeout(timer); timer = setTimeout(persist, 600); };
    const setValue = (fid, v) => { data.values[fid] = v; changed(); };

    const root = h("div", { class: "screen" });
    const list = h("div", { class: "scroll stack" });
    let sectionsCache = null;
    const getSections = () => (sectionsCache = sectionsCache || sections(type, data, lang));

    function rerender() {
        const y = window.scrollY;
        sectionsCache = null;
        list.replaceChildren(...content());
        window.scrollTo(0, y);
    }

    // --- champs
    function fieldInput(f, value, onChange, ex, onStructure, gid = null) {
        const label = tr(f.label) + (f.required ? " *" : "");
        const exText = ex ? tr(ex) : "";
        const help = [];
        if (f.hint) help.push(tr(f.hint));
        const short = ["TEXT", "PHONE", "EMAIL", "NUMBER", "DATE"].includes(f.type);
        const wrap = h("div", { class: "field" + (short ? " short" : "") });
        const helpEl = () => {
            if (!help.length && !exText) return null;
            return h("div", { class: "help" }, help.join("\n"), help.length && exText ? "\n" : "", exText ? [h("b", {}, s("example_prefix")), " " + exText.replace(/\n/g, " · ")] : "");
        };
        switch (f.type) {
            case "CHOICE": {
                const cur = parseInt(value, 10) || 0;
                wrap.append(h("span", { class: "label" }, label),
                    h("div", { class: "chips" }, f.options.map((o, i) => h("button", { type: "button", class: "chip" + (i === cur ? " on" : ""), onClick: () => { onChange(String(i)); onStructure(); } }, tr(o)))));
                return wrap;
            }
            case "IMAGE":
                wrap.append(h("span", { class: "label" }, label), imageInput(value, (v) => { onChange(v); onStructure(); }));
                return wrap;
            case "SECTION": {
                const sel = h("select", { class: "input" });
                const fill = () => {
                    const opts = getSections();
                    sel.replaceChildren(h("option", { value: "" }, "—"), ...opts.map((o) => h("option", { value: o, selected: o === value }, o)));
                    if (value && !opts.includes(value)) sel.appendChild(h("option", { value, selected: true }, value));
                };
                fill();
                sel.addEventListener("focus", () => { sectionsCache = null; fill(); });
                sel.addEventListener("change", () => { value = sel.value; onChange(sel.value); });
                wrap.append(h("label", {}, label), sel);
                return wrap;
            }
            default: {
                const multi = f.type === "MULTILINE" || f.type === "LIST";
                const attrs = { class: "input", placeholder: multi ? "" : exText.split("\n")[0], dir: "auto" };
                if (f.type === "PHONE") Object.assign(attrs, { type: "tel", inputmode: "tel", autocomplete: "tel" });
                else if (f.type === "EMAIL") Object.assign(attrs, { type: "email", inputmode: "email", autocomplete: "email" });
                else if (f.type === "NUMBER") Object.assign(attrs, { inputmode: "decimal" });
                const el = multi ? h("textarea", attrs) : h("input", attrs);
                el.value = value || "";
                if (multi) { el.placeholder = exText; el.rows = Math.min(10, Math.max(3, String(value || "").split("\n").length + 1)); }
                el.addEventListener("input", () => onChange(el.value));
                wrap.append(h("label", {}, label), el);
                const he = helpEl();
                if (he) wrap.append(he);
                if (multi && gid !== "figures" && !f.id.startsWith("cv_")) {
                    wrap.classList.add("wide-field");
                    wrap.append(richTools(el, {
                        rich: allowsImage(type, f), values: data.values, setValue: (k, v) => { data.values[k] = v; changed(); },
                        s, tr, chartTypes: CHART_TYPES, Images, toast, lang, pro: Pro,
                    }));
                }
                return wrap;
            }
        }
    }

    function imageInput(ref, onChange) {
        const box = h("div");
        const file = h("input", { type: "file", accept: "image/*", class: "hidden" });
        file.addEventListener("change", async () => {
            const f = file.files && file.files[0];
            if (!f) return;
            toast(s("importing"), 1500);
            try { const id = await Images.importFile(f); if (ref) Images.remove(ref); onChange(id); }
            catch (e) { toast(s("image_error")); }
        });
        const pick = () => file.click();
        if (!ref) {
            box.append(h("button", { type: "button", class: "img-add", onClick: pick }, icon("photo"), s("choose_image")), file);
        } else {
            const img = h("img", { alt: "" });
            Images.url(ref).then((u) => { if (u) img.src = u; });
            box.append(h("div", { class: "img-box" }, img,
                h("div", { class: "img-actions" },
                    h("button", { type: "button", class: "btn soft", onClick: pick }, s("change_image")),
                    h("button", { type: "button", class: "btn ghost", onClick: () => { Images.remove(ref); onChange(""); } }, s("remove")))), file);
        }
        return box;
    }

    function rubricImage(values, fid, onSet) {
        const ref = values[imgKey(fid)] || "";
        const wrap = h("div", { class: "rubric-img" });
        if (!ref) {
            const file = h("input", { type: "file", accept: "image/*", class: "hidden" });
            file.addEventListener("change", async () => {
                const f = file.files && file.files[0];
                if (!f) return;
                toast(s("importing"), 1500);
                try { onSet(imgKey(fid), await Images.importFile(f)); rerender(); } catch (e) { toast(s("image_error")); }
            });
            wrap.append(h("button", { type: "button", class: "img-add", onClick: () => file.click() }, icon("photo"), s("add_section_image")), file);
        } else {
            const cap = h("input", { class: "input", placeholder: s("image_caption"), dir: "auto" });
            cap.value = values[capKey(fid)] || "";
            cap.addEventListener("input", () => onSet(capKey(fid), cap.value));
            wrap.append(h("div", { class: "label" }, s("section_image")),
                imageInput(ref, (v) => { onSet(imgKey(fid), v); rerender(); }),
                h("div", { style: { marginTop: "8px" } }, cap));
        }
        return wrap;
    }

    // --- thème et police
    function themePicker() {
        const cur = themeOf(data).id;
        const slides = type.module === "SLIDES";
        const list = slides ? THEMES.filter((t) => t.hasSlide) : THEMES;
        const row = h("div", { class: "themes" + (slides ? " wide" : "") }, list.map((t) => {
            const th = h("div", { class: "th" });
            if (t.hasCover || t.hasSlide) th.appendChild(h("img", { src: `assets/themes/${t.id}_${slides ? "sthumb" : "thumb"}.jpg`, alt: "", loading: "lazy" }));
            else th.appendChild(h("div", { class: "plain" }, h("i"), h("i"), h("i"), h("i", { style: { width: "70%" } }), h("i")));
            th.appendChild(h("div", { class: "dots" }, h("b", { style: { background: css(t.primary) } }), h("b", { style: { background: css(t.accent) } })));
            if (t.id === cur) th.appendChild(h("div", { class: "check" }, "✓"));
            return h("button", { type: "button", class: "theme" + (t.id === cur ? " on" : ""), style: { "--tc": css(t.primary) },
                onClick: () => { data.theme = t.id; changed(); rerender(); } }, th, h("div", { class: "nm" }, tr(t.name)));
        }));
        requestAnimationFrame(() => { const on = row.querySelector(".theme.on"); if (on) row.scrollLeft = on.offsetLeft - 16; });
        return h("div", {}, h("div", { class: "title-m" }, s(slides ? "slide_theme_title" : "theme_title")),
            h("div", { class: "small muted", style: { marginBottom: "8px" } }, s(slides ? "slide_theme_sub" : "theme_sub")), row);
    }

    function fontPicker() {
        const cur = data.font || "";
        const chips = [h("button", { type: "button", class: "chip" + (cur === "" ? " on" : ""), onClick: () => { data.font = ""; changed(); rerender(); } }, s("font_theme"))];
        for (const f of FONTS) {
            const fam = f.file ? `"F-${f.id}", sans-serif` : f.id === "times" ? '"Times New Roman", serif' : "Arial, sans-serif";
            if (f.file) ensureFont(f.id);
            chips.push(h("button", { type: "button", class: "chip" + (cur === f.id ? " on" : ""), style: { fontFamily: fam }, onClick: () => { data.font = f.id; changed(); rerender(); } }, f.label));
        }
        return h("div", {}, h("div", { class: "title-m", style: { marginTop: "14px" } }, s("font_title")),
            h("div", { class: "small muted", style: { marginBottom: "8px" } }, s("font_hint")), h("div", { class: "chips" }, chips));
    }

    // --- groupes
    function groupInput(g) {
        const items = data.groups[g.id] || (data.groups[g.id] = []);
        const out = h("div", {}, h("div", { class: "group-title" }, tr(g.label)));
        if (g.columns && g.columns.length) {
            const on = columnsOn(data.values, g);
            out.appendChild(h("div", { class: "small muted", style: { marginBottom: "6px" } }, s("columns_shown")));
            out.appendChild(h("div", { class: "chips", style: { marginBottom: "12px" } }, g.columns.map((col, i) => h("button", {
                type: "button", class: "chip" + (on[i] ? " on" : ""),
                onClick: () => {
                    const next = on.slice(); next[i] = !next[i];
                    if (!next.some((x) => x)) return;
                    setValue(`${g.id}_cols`, next.map((x) => (x ? "1" : "0")).join("")); rerender();
                },
            }, (on[i] ? "✓ " : "") + tr(col)))));
        }
        items.forEach((item, index) => {
            const card = h("div", { class: "card", style: { marginBottom: "12px" } },
                h("div", { class: "item-head" },
                    h("div", { class: "title-m" }, `${tr(g.itemLabel)} ${index + 1}`),
                    index > 0 ? h("button", { class: "icon-btn", "aria-label": s("move_up"), onClick: () => { items.splice(index - 1, 0, items.splice(index, 1)[0]); changed(); rerender(); } }, icon("up")) : null,
                    index < items.length - 1 ? h("button", { class: "icon-btn", "aria-label": s("move_down"), onClick: () => { items.splice(index + 1, 0, items.splice(index, 1)[0]); changed(); rerender(); } }, icon("down")) : null,
                    h("button", { class: "icon-btn", "aria-label": s("remove"), onClick: () => { items.splice(index, 1); changed(); rerender(); } }, icon("close"))));
            for (const f of g.fields.filter((x) => isVisible(x, item))) {
                card.appendChild(fieldInput(f, item[f.id] || "", (v) => { item[f.id] = v; changed(); }, example(type.id, g.id, f.id), rerender, g.id));
                if (g.id !== "figures" && allowsImage(type, f)) card.appendChild(rubricImage(item, f.id, (k, v) => { item[k] = v; changed(); }));
            }
            out.appendChild(card);
        });
        out.appendChild(h("button", { class: "btn soft add-btn", onClick: () => { items.push({}); changed(); rerender(); } }, icon("add"), s("add_item", tr(g.itemLabel))));
        return out;
    }

    function content() {
        const nodes = [];
        const style = h("div", { class: "card" }, themePicker(), fontPicker());
        if (type.supportsCover) {
            const sw = h("input", { type: "checkbox" });
            sw.checked = !!data.cover;
            sw.addEventListener("change", () => { data.cover = sw.checked; changed(); rerender(); });
            style.appendChild(h("div", { class: "row", style: { marginTop: "14px" } },
                h("div", { class: "grow" }, h("div", { class: "title-m" }, s("cover_page")), h("div", { class: "small muted" }, s("cover_sub"))),
                h("label", { class: "switch" }, sw, h("span"))));
            if (data.cover && type.coverFields.length) {
                const cf = h("div", { class: "fields", style: { marginTop: "12px" } });
                for (const f of type.coverFields.filter((x) => isVisible(x, data.values))) cf.appendChild(fieldInput(f, data.values[f.id] || "", (v) => setValue(f.id, v), example(type.id, null, f.id), rerender));
                style.appendChild(cf);
            }
        }
        nodes.push(style);
        const fields = h("div", { class: "card fields" });
        for (const f of type.fields.filter((x) => isVisible(x, data.values))) {
            fields.appendChild(fieldInput(f, data.values[f.id] || "", (v) => setValue(f.id, v), example(type.id, null, f.id), rerender));
            if (allowsImage(type, f)) fields.appendChild(rubricImage(data.values, f.id, (k, v) => setValue(k, v)));
        }
        fields.appendChild(h("div", { class: "small muted", style: { marginTop: "12px" } }, s("required_hint")));
        nodes.push(fields);
        for (const g of type.groups) nodes.push(groupInput(g));
        nodes.push(h("div", { class: "small muted" }, s("auto_saved")));
        return nodes;
    }

    function validate() {
        const out = [];
        const fd = new Form(data);
        type.fields.filter((f) => f.required && isVisible(f, data.values) && !fd.v(f.id)).forEach((f) => out.push(tr(f.label)));
        for (const g of type.groups) {
            const items = fd.items(g.id);
            if (items.length < g.minItems) out.push(s("min_items", tr(g.label), g.minItems));
            items.forEach((item) => g.fields.filter((f) => f.required && isVisible(f, item) && !String(item[f.id] || "").trim())
                .forEach((f) => out.push(`${tr(g.itemLabel)} : ${tr(f.label)}`)));
        }
        return [...new Set(out)];
    }

    list.replaceChildren(...content());
    root.append(topbar(tr(type.title), async () => { clearTimeout(timer); await persist(); history.length > 1 ? history.back() : go("home"); }), list,
        h("div", { class: "bottom-bar" }, h("button", { class: "btn", onClick: async () => {
            const problems = validate();
            if (problems.length) { toast(s("required_missing", problems.join(", ")), 5000); return; }
            clearTimeout(timer); await persist(); go("preview/" + id);
        } }, icon("eye"), s("preview_export"))));
    mount(root);
    leaveHook = () => { clearTimeout(timer); return persist(); };
}

// ---------------------------------------------------------------- Aperçu et export

async function previewScreen(id) {
    const draft = await Drafts.get(id);
    const type = draft && typeById(draft.typeId);
    if (!type) return go("home");
    const pagesBox = h("div", { class: "pages" }, h("div", { class: "spinner" }), h("div", { class: "muted" }, s("generating")));
    let format = type.formats[0];
    const chips = h("div", { class: "chips", style: { margin: "6px 0 12px" } });
    const label = { PDF: s("format_pdf"), DOCX: s("format_docx"), PPTX: s("format_pptx"), PNG: s("format_png") };
    const locked = (f) => Pro.isPro(type, f) && !Pro.isUnlocked(id);
    const drawChips = () => chips.replaceChildren(...type.formats.map((f) => h("button", { class: "chip" + (f === format ? " on" : ""), onClick: () => { format = f; drawChips(); } },
        label[f] + (locked(f) ? " · " + s("pro_badge") : ""))));
    drawChips();
    let busy = false;
    /** Document Pro : utiliser un crédit (ou en acheter). Renvoie true si l'export peut continuer. */
    const gate = () => (!locked(format) ? Promise.resolve(true) : proDialog(id).then((ok) => { drawChips(); return ok; }));
    async function make() {
        const blob = await exportFile(type, draft.data, lang, format);
        return { blob, name: fileName(type, draft.data, lang, format) };
    }
    async function save() {
        if (busy) return;
        if (!(await gate())) return;
        busy = true;
        try {
            const { blob, name } = await make();
            const url = URL.createObjectURL(blob);
            const a = h("a", { href: url, download: name });
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            toast(s("file_saved"));
        } catch (e) { console.error(e); toast(s("export_error")); }
        busy = false;
    }
    async function share() {
        if (busy) return;
        if (!(await gate())) return;
        busy = true;
        try {
            const { blob, name } = await make();
            const file = new File([blob], name, { type: MIME[format] });
            if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: name });
            else { busy = false; await save(); return; }
        } catch (e) { if (e && e.name !== "AbortError") { console.error(e); toast(s("export_error")); } }
        busy = false;
    }
    mount(h("div", { class: "screen preview-screen" }, topbar(s("preview"), () => go("form/" + id)),
        h("div", { class: "scroll" }, pagesBox),
        h("div", { class: "export" }, h("div", { class: "inner" },
            h("div", { class: "title-m" }, s("download_as")), chips,
            h("div", { class: "row" },
                h("button", { class: "btn", onClick: save }, icon("download"), s("save_to_phone")),
                h("button", { class: "btn soft", onClick: share }, icon("share"), s("share")))))));
    try {
        const r = await preview(type, draft.data, lang);
        const n = r.pages.length;
        pagesBox.replaceChildren(...r.pages.flatMap((cv, i) => [cv, h("div", { class: "pageno" }, s("page_n", i + 1, n))]),
            h("div", { class: "muted small" }, s("end_of_document")));
    } catch (e) {
        console.error(e);
        pagesBox.replaceChildren(h("div", { class: "muted" }, s("export_error")));
    }
}

// ---------------------------------------------------------------- Gratuit / Pro

function packButtons(onDone) {
    if (!Pro.online()) return [h("div", { class: "small muted" }, s("pro_buy_soon"))];
    return Pro.PACKS.map((p) => h("button", { class: "btn ghost", style: { width: "100%" }, onClick: async () => {
        try { await Pro.buy(p.id); } catch (e) { toast(s("pro_code_error", e.message)); }
        if (onDone) onDone();
    } }, s("pro_pack", String(p.credits), String(p.price))));
}

function proDialog(draftId) {
    return new Promise((resolve) => {
        const back = h("div", { class: "dialog-back" });
        const close = (v) => { back.remove(); resolve(v); };
        const body = h("div", { class: "stack-s" });
        const draw = () => {
            const n = Pro.credits();
            body.replaceChildren(...[
                h("div", { class: "muted" }, s("pro_explain")),
                h("div", { class: "title-m", style: { color: "var(--primary)" } }, s("pro_credits", n)),
                n > 0 ? h("button", { class: "btn", style: { width: "100%" }, onClick: () => { if (Pro.unlock(draftId)) { toast(s("pro_unlocked", Pro.UNLOCK_DAYS)); close(true); } } }, s("pro_use_credit")) : null,
                h("div", { class: "small muted", style: { marginTop: "6px" } }, s("pro_buy_title")),
                ...packButtons(),
                Pro.TEST_MODE ? h("button", { class: "btn soft", style: { width: "100%" }, onClick: () => { Pro.addCredits(3); draw(); } }, s("pro_test_add")) : null].filter(Boolean));
        };
        draw();
        back.appendChild(h("div", { class: "dialog wide", role: "dialog" }, h("h3", {}, s("pro_title")), body,
            h("div", { class: "actions" }, h("button", { onClick: () => close(false) }, s("cancel")))));
        back.addEventListener("click", (e) => { if (e.target === back) close(false); });
        document.body.appendChild(back);
    });
}

function proCard() {
    const count = h("div", { class: "title-m" }, s("pro_credits", Pro.credits()));
    const code = h("input", { class: "input", placeholder: s("pro_code_label"), autocapitalize: "characters", spellcheck: "false" });
    const refresh = () => { count.textContent = s("pro_credits", Pro.credits()); };
    const redeemBtn = h("button", { class: "btn", style: { width: "100%" }, onClick: async () => {
        if (!code.value.trim()) return;
        if (!Pro.online()) { toast(s("pro_offline")); return; }
        try { const n = await Pro.redeem(code.value); code.value = ""; refresh(); toast(s("pro_code_ok", n)); }
        catch (e) { toast(s("pro_code_error", e.message)); }
    } }, s("pro_code_btn"));
    return h("div", { class: "card stack-s" }, count,
        h("div", { class: "small muted" }, s("pro_device_id", Pro.deviceId())),
        h("div", { class: "small muted" }, s("pro_web_note")),
        code, redeemBtn,
        h("div", { class: "small muted", style: { marginTop: "6px" } }, s("pro_buy_title")), ...packButtons(),
        Pro.TEST_MODE ? h("button", { class: "btn soft", style: { width: "100%" }, onClick: () => { Pro.addCredits(3); refresh(); } }, s("pro_test_add")) : null);
}

// ---------------------------------------------------------------- Réglages, FAQ, À propos

function choiceDialog(title, options, current, onPick) {
    const back = h("div", { class: "dialog-back" });
    const close = () => back.remove();
    back.appendChild(h("div", { class: "dialog" }, h("h3", {}, title),
        h("div", { class: "stack" }, options.map(([v, l]) => h("button", { class: "chip" + (v === current ? " on" : ""), style: { width: "100%", textAlign: "start" }, onClick: () => { close(); onPick(v); } }, l))),
        h("div", { class: "actions" }, h("button", { onClick: close }, s("cancel")))));
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    document.body.appendChild(back);
}

function settings() {
    const langs = [["system", s("lang_system")], ["fr", "Français"], ["en", "English"], ["ar", "العربية"]];
    const themes = [["system", s("theme_system")], ["light", s("theme_light")], ["dark", s("theme_dark")]];
    const curL = Settings.get("lang", "system"), curT = Settings.get("theme", "system");
    const row = (ic, title, sub, onClick) => h("button", { class: "setting", onClick },
        h("div", { class: "bubble", style: { background: "var(--primary-soft)", color: "var(--on-primary-soft)", width: "40px", height: "40px" } }, icon(ic)),
        h("div", { class: "grow" }, h("div", { class: "title-m", style: { fontSize: "15px" } }, title), h("div", { class: "small muted" }, sub)), icon("chevron", "chev"));
    const mail = `mailto:${CONTACT.email}?subject=${encodeURIComponent(s("email_subject"))}`;
    const round = (href, color, ic, l) => h("a", { class: "contact", href, target: href.startsWith("http") ? "_blank" : null, rel: "noopener" },
        h("div", { class: "round", style: { background: color } }, icon(ic)), l);
    mount(h("div", { class: "screen" }, topbar(s("settings"), () => go("home")), h("div", { class: "scroll" },
        h("div", { class: "section-label" }, s("section_preferences")),
        h("div", { class: "card", style: { padding: "4px 16px" } },
            row("translate", s("language"), langs.find((x) => x[0] === curL)[1], () => choiceDialog(s("language"), langs, curL, (v) => { Settings.set("lang", v); applyPrefs(); settings(); })),
            row("palette", s("theme"), themes.find((x) => x[0] === curT)[1], () => choiceDialog(s("theme"), themes, curT, (v) => { Settings.set("theme", v); applyPrefs(); settings(); }))),
        h("div", { class: "section-label" }, s("pro_section")),
        proCard(),
        isStandalone() ? null : h("div", { class: "section-label" }, s("install_app")),
        isStandalone() ? null : h("div", { class: "card" }, h("div", { class: "muted small", style: { marginBottom: "10px" } }, s("install_hint")), installButton()),
        h("div", { class: "section-label" }, s("section_help")),
        h("div", { class: "card", style: { padding: "4px 16px" } },
            row("help", s("faq"), s("faq_sub"), () => go("faq")),
            row("info", s("about"), s("about_sub"), () => go("about"))),
        h("div", { class: "section-label" }, s("section_contact")),
        h("div", { class: "card" }, h("div", { class: "muted", style: { textAlign: "center" } }, s("contact_hint")),
            h("div", { class: "contacts" },
                round(mail, "#4F46E5", "letter", s("contact_email")),
                round(`https://wa.me/${CONTACT.whatsapp}`, "#25D366", "chat", s("contact_whatsapp")),
                round(`tel:${CONTACT.phone}`, "#0EA5E9", "call", s("contact_call")))),
        h("div", { class: "small muted", style: { textAlign: "center", margin: "18px 0" } }, s("version", VERSION + " (web)")))));
}

function faq() {
    const items = [1, 2, 3, 4, 5, 6].map((i) => h("details", { class: "faq" }, h("summary", {}, s("faq_q" + i)), h("p", {}, s("faq_a" + i))));
    mount(h("div", { class: "screen" }, topbar(s("faq"), () => go("settings")), h("div", { class: "scroll" }, items)));
}

function about() {
    mount(h("div", { class: "screen" }, topbar(s("about"), () => go("settings")), h("div", { class: "scroll stack", style: { textAlign: "center" } },
        h("img", { src: "img/logo_fafio_full.jpg", alt: "FAFIO", style: { width: "220px", maxWidth: "70%", borderRadius: "24px", margin: "8px auto 0", display: "block" } }),
        h("div", { class: "small muted" }, s("version", VERSION + " (web)")),
        h("p", {}, s("about_text")), h("p", { class: "muted" }, s("about_company")), h("p", { class: "small muted" }, s("rights")))));
}

// ---------------------------------------------------------------- Navigation

let leaveHook = null;
async function route() {
    if (leaveHook) { const hk = leaveHook; leaveHook = null; try { await hk(); } catch (e) { /* rien */ } }
    const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
    switch (name) {
        case "home": return home();
        case "module": return moduleScreen(arg);
        case "documents": return documents();
        case "form": return formScreen(arg);
        case "preview": return previewScreen(arg);
        case "settings": return settings();
        case "faq": return faq();
        case "about": return about();
        case "welcome": return welcome();
        default: return Settings.get("seen", "") === "1" ? home() : welcome();
    }
}

window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && leaveHook) leaveHook(); });
applyPrefs();
route();
// Retour d'un paiement Mobile Money : on récupère le code et on ajoute les crédits
Pro.checkPending().then((r) => {
    if (!r) return;
    if (r.failed) toast(s("pro_pay_fail"));
    else { toast(s("pro_pay_ok", String(r.credits), r.code), 12000); if ((location.hash || "").includes("settings")) settings(); }
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
