// Tous les types de documents proposés par FAFIO (copie de Catalog.kt).
import { Block, Slide, lines } from "../doc.js";
import { t, F, G, TODAY, YEAR, Form, B, imgKey, capKey, hasImg, number, formatNumber } from "./model.js";
import { themeOf } from "./themes.js";
import { membersGroup, members, memberNames, applyMembers, measureTable } from "./science.js";

// ------------------------------------------------------------ Libellés communs
const L_INSTITUTION = t("Établissement", "Institution", "المؤسسة");
const L_TITLE = t("Titre", "Title", "العنوان");
const L_SUBTITLE = t("Sous-titre", "Subtitle", "العنوان الفرعي");
const L_AUTHORS = t("Auteur(s)", "Author(s)", "المؤلف (المؤلفون)");
const L_DATE = t("Date", "Date", "التاريخ");
const L_INTRO = t("Introduction", "Introduction", "مقدمة");
const L_CONCLUSION = t("Conclusion", "Conclusion", "خاتمة");
const L_ORG = t("Organisation / structure", "Organisation", "الهيئة / المؤسسة");
const L_CITY = t("Lieu (ville)", "Place (city)", "المكان (المدينة)");
const H_ONE_PER_LINE = t("Un élément par ligne", "One item per line", "عنصر واحد في كل سطر");
const H_TABLE = t(
    "Une ligne par rangée, valeurs séparées par « ; ». La 1re ligne contient les titres des colonnes.",
    "One line per row, values separated by \";\". The first line holds the column titles.",
    "سطر لكل صف، والقيم مفصولة بـ « ; ». السطر الأول يحتوي على عناوين الأعمدة.");
const H_AUTHORS = t("Un nom par ligne", "One name per line", "اسم واحد في كل سطر");

const date = (id = "date") => F(id, L_DATE, { type: "DATE", def: TODAY });
const ML = "MULTILINE", LIST = "LIST";

// ------------------------------------------------------------ Couverture officielle
const HEADER_FR = "REPUBLIQUE DU CAMEROUN\nPaix-Travail-Patrie\n*********\nMINISTERE DE L'ENSEIGNEMENT SUPERIEUR\n*********\nUNIVERSITE DE …\n*********\nFACULTE DE …";
const HEADER_EN = "REPUBLIC OF CAMEROON\nPeace-Work-Fatherland\n*********\nMINISTRY OF HIGHER EDUCATION\n*********\nUNIVERSITY OF …\n*********\nFACULTY OF …";

export const COVER = [
    F("cv_model", t("Modèle de couverture", "Cover template", "نموذج الغلاف"), { type: "CHOICE",
        options: [t("Simple", "Simple", "بسيط"), t("Officiel – exposé", "Official – talk", "رسمي – عرض"), t("Officiel – TP", "Official – lab", "رسمي – أعمال تطبيقية")] }),
    F("cv_header_fr", t("En-tête, colonne de gauche (français)", "Header, left column (French)", "الترويسة، العمود الأيسر (بالفرنسية)"), { type: ML,
        hint: t("Une ligne par niveau. Garde les lignes ***** pour les séparateurs.", "One line per level. Keep the ***** lines as separators.", "سطر لكل مستوى. احتفظ بأسطر ***** كفواصل."),
        def: HEADER_FR, visibleIf: ["cv_model", "!0"] }),
    F("cv_header_en", t("En-tête, colonne de droite (anglais)", "Header, right column (English)", "الترويسة، العمود الأيمن (بالإنجليزية)"), { type: ML, def: HEADER_EN, visibleIf: ["cv_model", "!0"] }),
    F("cv_logo_left", t("Logo de l'université", "University logo", "شعار الجامعة"), { type: "IMAGE", visibleIf: ["cv_model", "!0"] }),
    F("cv_logo_right", t("Logo de la faculté / de l'école", "Faculty / school logo", "شعار الكلية / المدرسة"), { type: "IMAGE", visibleIf: ["cv_model", "1"] }),
    F("cv_lab", t("Laboratoire / département", "Laboratory / department", "المخبر / القسم"), { visibleIf: ["cv_model", "2"] }),
    F("cv_group", t("Jour et heure de la séance", "Session day and time", "يوم وساعة الحصة"), { visibleIf: ["cv_model", "2"] }),
    F("cv_info", t("Autres informations (facultatif, une par ligne)", "Other details (optional, one per line)", "معلومات أخرى (اختياري، واحدة في كل سطر)"), { type: ML, visibleIf: ["cv_model", "2"] }),
    F("cv_grades", t("Cadres « Note finale » et « Observation »", "“Final mark” and “Comments” boxes", "خانتا « العلامة النهائية » و« الملاحظة »"), { type: "CHOICE",
        options: [t("Oui", "Yes", "نعم"), t("Non", "No", "لا")], visibleIf: ["cv_model", "2"] }),
    F("cv_border", t("Bordure autour de la page de garde", "Border around the cover page", "إطار حول صفحة الغلاف"), { type: "CHOICE",
        options: [t("Non", "No", "لا"), t("Oui", "Yes", "نعم")], visibleIf: ["cv_model", "!0"] }),
    F("cv_supervision", t("Sous la supervision de", "Supervised by", "تحت إشراف"), { type: LIST, hint: H_AUTHORS, visibleIf: ["cv_model", "1"] }),
    F("cv_year", t("Année académique", "Academic year", "السنة الجامعية"), { def: YEAR, visibleIf: ["cv_model", "!0"] }),
];

const NO_IMAGE = new Set(["authors", "attendees", "absents", "agenda", "columns", "fields", "options", "data", "sender_address", "recipient",
    "org_details", "closing", "purpose", "attachments", "copies", "references", "calc", "desc"]);

/** Une rubrique peut-elle recevoir une image ? */
export function allowsImage(type, f) {
    return type.module !== "CV" && type.module !== "CHARTS" && (f.type === ML || f.type === LIST) && !NO_IMAGE.has(f.id) && !f.id.startsWith("cv_");
}

export const CHART_TYPES = [t("Courbe", "Line", "منحنى"), t("Barres", "Bars", "أعمدة"), t("Secteurs", "Pie", "دائرة"),
    t("Points + droite de régression", "Points + regression line", "نقاط + خط الانحدار")];

export const FIGURES = G("figures", t("Images et graphiques", "Images and charts", "الصور والرسوم البيانية"), t("Figure", "Figure", "شكل"), [
    F("kind", t("Type", "Type", "النوع"), { type: "CHOICE", options: [t("Image", "Image", "صورة"), t("Graphique", "Chart", "رسم بياني")] }),
    F("image", t("Image", "Image", "الصورة"), { type: "IMAGE", visibleIf: ["kind", "0"] }),
    F("chart_type", t("Type de graphique", "Chart type", "نوع الرسم البياني"), { type: "CHOICE", options: CHART_TYPES, visibleIf: ["kind", "1"] }),
    F("x_label", t("Nom de l'axe horizontal (X)", "Horizontal axis name (X)", "اسم المحور الأفقي (س)"), { visibleIf: ["kind", "1"] }),
    F("y_label", t("Nom de l'axe vertical (Y)", "Vertical axis name (Y)", "اسم المحور العمودي (ص)"), { visibleIf: ["kind", "1"] }),
    F("data", t("Données (X ; Y)", "Data (X ; Y)", "البيانات (س ; ص)"), { type: ML,
        hint: t("Une ligne par point : abscisse ; ordonnée.", "One line per point: x ; y.", "سطر لكل نقطة: س ; ص."), visibleIf: ["kind", "1"] }),
    F("caption", t("Légende", "Caption", "التعليق")),
    F("after", t("Placer après la section", "Place after section", "ضعها بعد القسم"), { type: "SECTION" }),
], { startItems: 0 });

// ------------------------------------------------------------ Aides
const base = (f) => { const d = new B(); d.style = f.style; d.cover = false; return d; };
const labelled = (label, value) => (String(value).trim() ? `${label} : ${value}` : "");
const join = (a, sep) => a.filter((x) => String(x).trim()).join(sep);

function cover(f, lang, o) {
    const d = base(f);
    d.cover = f.cover;
    d.title = o.title; d.subtitle = o.subtitle; d.author = o.author; d.institution = o.institution; d.extra = o.extra || ""; d.date = o.date;
    const model = parseInt(f.v("cv_model"), 10) || 0;
    if (f.cover && model > 0) {
        d.coverModel = model === 2 ? "TP" : "EXPOSE";
        d.headerLeft = f.v("cv_header_fr"); d.headerRight = f.v("cv_header_en");
        d.logoLeftRef = f.v("cv_logo_left");
        d.logoRightRef = model === 1 ? f.v("cv_logo_right") : "";
        d.supervision = f.v("cv_supervision"); d.group = f.v("cv_group"); d.infoLines = f.v("cv_info");
        if (model === 2) { d.extra = ""; d.institution = f.v("cv_lab"); }
        d.date = f.v("cv_year") || o.date;
        d.toc = true; d.numberHeadings = true; d.pageWordFooter = true;
        const single = lines(o.author).length <= 1;
        d.participantsLabel = single ? t("PRÉSENTÉ PAR :", "PRESENTED BY:", "إعداد:").get(lang) : t("NOMS DES PARTICIPANTS :", "PARTICIPANTS:", "أسماء المشاركين:").get(lang);
        d.themeLabel = t("THEME", "TOPIC", "الموضوع").get(lang);
        d.supervisionLabel = t("Sous la supervision de", "Supervised by", "تحت إشراف").get(lang);
        d.tocTitle = t("PLAN DE TRAVAIL", "OUTLINE", "خطة العمل").get(lang);
    }
    return d;
}

function placeDate(lang, city, dt) {
    if (!city) return dt;
    if (!dt) return city;
    if (lang === "en") return `${city}, ${dt}`;
    if (lang === "ar") return `${city}، في ${dt}`;
    return `${city}, le ${dt}`;
}

function letter(f, lang, o) {
    const d = base(f);
    d.add(Block.para(o.sender, "LEFT", true));
    o.senderLines.flatMap((x) => lines(x)).forEach((l) => d.add(Block.para(l, "LEFT", false).size(10)));
    d.add(Block.spacer());
    d.line(placeDate(lang, f.v("city"), f.v("date")), "RIGHT");
    d.add(Block.spacer());
    lines(o.recipient).forEach((l) => d.add(Block.para(l, "RIGHT", true)));
    d.add(Block.spacer());
    if (o.reference) d.line(labelled(t("Réf.", "Ref.", "المرجع").get(lang), o.reference));
    d.line(labelled(t("Objet", "Subject", "الموضوع").get(lang), f.v("subject")), "LEFT", true);
    const att = lines(f.v("attachments"));
    if (att.length) d.line(labelled(t("P.J.", "Encl.", "المرفقات").get(lang), String(att.length)));
    d.add(Block.spacer());
    d.line(f.v("salutation"));
    f.v("body").split(/\n\s*\n/).map((x) => x.replace(/\n/g, " ").trim()).filter((x) => x).forEach((x) => d.para(x));
    d.slot(f.values, "body");
    f.v("closing").split(/\n\s*\n/).map((x) => x.replace(/\n/g, " ").trim()).filter((x) => x).forEach((x) => d.para(x));
    d.add(Block.spacer());
    d.line(o.signFunction, "RIGHT", false);
    d.add(Block.spacer()); d.add(Block.spacer());
    d.line(o.signName, "RIGHT", true);
    if (att.length) { d.add(Block.spacer()); d.line(t("Pièces jointes :", "Enclosures:", "المرفقات:").get(lang), "LEFT", true); d.add(Block.bullets(att)); }
    if (lines(o.copies).length) { d.line(t("Copies :", "Copies to:", "نسخ إلى:").get(lang), "LEFT", true); d.add(Block.bullets(lines(o.copies))); }
    return d;
}

export function chartSpec(f) {
    const pts = [];
    for (const p of f.items("points")) {
        const y = number(p.y);
        if (y == null) continue;
        pts.push([String(p.x || "").trim(), y]);
    }
    const type = ["LINE", "BAR", "PIE", "REG"][f.choice("type")] || "LINE";
    return { type, title: f.v("title"), xLabel: f.v("x_label"), yLabel: f.v("y_label"), points: pts, accent: themeOf(f).primary };
}

const ALL = ["PDF", "DOCX"];
const SLIDES = ["PPTX", "PDF", "DOCX"];

// ============================================================ 1. RAPPORTS

const TP_MEMBERS = membersGroup(t("Présenté par (membres du groupe)", "Presented by (group members)", "إعداد (أعضاء الفوج)"));
const ROLES = [t("Examinateur", "Examiner", "الممتحن"), t("Encadreur", "Supervisor", "المؤطر"), t("Enseignant", "Teacher", "الأستاذ")];

const TP = {
    id: "tp", module: "REPORTS", coverFields: COVER, defaultCoverModel: 2, supportsCover: true, defaultCover: true, formats: ALL,
    title: t("Compte rendu de TP", "Lab report", "تقرير أعمال تطبيقية"),
    description: t("Résumé, matériels et méthodes, résultats, graphiques", "Abstract, materials and methods, results, charts", "ملخص، الأدوات والطرق، النتائج، الرسوم"),
    groups: [
        TP_MEMBERS,
        G("equipment", t("Matériels utilisés", "Equipment used", "الأدوات المستعملة"), t("Matériel", "Item", "أداة"), [
            F("name", t("Nom du matériel", "Item name", "اسم الأداة")),
            F("desc", t("À quoi il sert (facultatif)", "What it is for (optional)", "دوره (اختياري)")),
            F("photo", t("Photo (facultatif)", "Photo (optional)", "صورة (اختياري)"), { type: "IMAGE" }),
        ], { startItems: 2 }),
        G("tables", t("Tableaux de mesures", "Measurement tables", "جداول القياسات"), t("Tableau", "Table", "جدول"), [
            F("title", t("Titre du tableau", "Table title", "عنوان الجدول")),
            F("layout", t("Disposition", "Layout", "الترتيب"), { type: "CHOICE",
                options: [t("Grandeurs en lignes (couché)", "Quantities in rows", "المقادير في أسطر"), t("Grandeurs en colonnes", "Quantities in columns", "المقادير في أعمدة")] }),
            F("data", t("Mesures", "Measurements", "القياسات"), { type: ML,
                hint: t("Une grandeur par ligne : nom (unité) ; valeur ; valeur …", "One quantity per line: name (unit) ; value ; value …", "مقدار في كل سطر: الاسم (الوحدة) ; قيمة ; قيمة …"), visibleIf: ["layout", "0"] }),
            F("data_cols", t("Mesures", "Measurements", "القياسات"), { type: ML,
                hint: t("1re ligne : les titres des colonnes, puis une ligne par essai, valeurs séparées par « ; ».", "First line: column titles, then one line per trial, values separated by \";\".", "السطر الأول: عناوين الأعمدة، ثم سطر لكل تجربة."), visibleIf: ["layout", "1"] }),
            F("calc", t("Grandeurs calculées automatiquement (facultatif)", "Auto-calculated quantities (optional)", "مقادير تُحسب تلقائيًا (اختياري)"), { type: ML,
                hint: t("Une formule par ligne : nouvelle grandeur = calcul. Utilise les noms des grandeurs (h, L, t…). Opérations : + − * / ^ sqrt sin cos ln.",
                    "One formula per line: new quantity = calculation, using the quantity names (h, L, t…). Operations: + − * / ^ sqrt sin cos ln.",
                    "صيغة في كل سطر: مقدار جديد = حساب، باستعمال أسماء المقادير. العمليات: + − * / ^ sqrt sin cos ln.") }),
        ], { startItems: 1 }),
        FIGURES,
    ],
    fields: [
        F("institution", L_INSTITUTION),
        F("course", t("Matière / UE (avec son code)", "Subject / course (with code)", "المادة / الوحدة (مع رمزها)")),
        F("title", t("Titre du TP", "Lab title", "عنوان العمل التطبيقي"), { required: true }),
        date(),
        F("supervisor_role", t("Titre du responsable", "Supervisor's title", "صفة المسؤول"), { type: "CHOICE", options: ROLES }),
        F("supervisor", t("Nom du responsable", "Supervisor's name", "اسم المسؤول")),
        F("abstract", t("Abstract (résumé en anglais, facultatif)", "Abstract (optional)", "ملخص بالإنجليزية (اختياري)"), { type: ML }),
        F("resume", t("Résumé (facultatif)", "Summary (optional)", "ملخص (اختياري)"), { type: ML }),
        F("intro", L_INTRO, { type: ML }),
        F("objectives", t("Objectifs", "Objectives", "الأهداف"), { type: ML }),
        F("principle", t("Principe / rappel théorique", "Principle / theory", "المبدأ / تذكير نظري"), { type: ML }),
        F("protocol", t("Méthode (étapes suivies)", "Method (steps followed)", "الطريقة (المراحل المتبعة)"), { type: LIST, hint: t("Une étape par ligne", "One step per line", "مرحلة واحدة في كل سطر") }),
        F("results", t("Résultats et calculs", "Results and calculations", "النتائج والحسابات"), { type: ML }),
        F("analysis", t("Interprétation", "Interpretation", "التفسير"), { type: ML }),
        F("applications", t("Quelques applications (facultatif)", "Some applications (optional)", "بعض التطبيقات (اختياري)"), { type: ML,
            hint: t("Commence une ligne par - pour une puce.", "Start a line with - for a bullet.", "ابدأ السطر بـ - لنقطة.") }),
        F("conclusion", L_CONCLUSION, { type: ML }),
        F("references", t("Bibliographie", "Bibliography", "المراجع"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("breaks", t("Chaque grande partie sur une nouvelle page", "Each main part on a new page", "كل جزء رئيسي في صفحة جديدة"), { type: "CHOICE",
            options: [t("Oui", "Yes", "نعم"), t("Non", "No", "لا")] }),
    ],
    build(f, c) {
        const l = c.lang;
        const role = (ROLES[f.choice("supervisor_role")] || ROLES[0]).get(l);
        const names = memberNames(f, TP_MEMBERS, f.v("authors"));
        const d = cover(f, l, { title: f.v("title"), subtitle: f.v("course"), author: names, institution: f.v("institution"),
            extra: labelled(role, f.v("supervisor") || f.v("cv_supervision")), date: f.v("date") });
        applyMembers(d, f, TP_MEMBERS, l, f.v("authors"));
        if (d.coverModel === "TP") {
            d.banner = [f.v("course"), f.v("cv_group"), f.v("title"), f.v("date")].filter((x) => x).join("\n");
            d.group = "";
            d.supervisionLabel = role;
            d.supervision = f.v("supervisor");
            d.gradeBoxes = f.v("cv_grades") !== "1";
            d.membersLabel = t("MEMBRES DU GROUPE", "GROUP MEMBERS", "أعضاء الفوج").get(l);
            d.gradeLabel = t("NOTE FINALE", "FINAL MARK", "العلامة النهائية").get(l);
            d.observationLabel = t("OBSERVATION", "COMMENTS", "ملاحظة").get(l);
            d.yearLabel = t("Année académique", "Academic year", "السنة الجامعية").get(l);
            d.tocTitle = t("TABLE DES MATIÈRES", "CONTENTS", "الفهرس").get(l);
        }
        d.pageBorder = f.cover && f.v("cv_border") === "1";
        d.breakBeforeH1 = f.v("breaks") !== "1";
        if (!d.cover) {
            d.docTitle(f.v("title")); d.line(f.v("course"), "CENTER");
            if (d.members.length) d.add(Block.table(d.memberHeader, d.members)); else d.line(lines(names).join(", "), "CENTER");
            d.line(labelled(role, f.v("supervisor")), "CENTER"); d.line(f.v("date"), "CENTER");
        }
        d.rubric(f.values, "abstract", "ABSTRACT");
        d.rubric(f.values, "resume", t("Résumé", "Summary", "ملخص").get(l));
        d.rubric(f.values, "intro", L_INTRO.get(l));
        d.rubric(f.values, "objectives", t("Objectifs", "Objectives", "الأهداف").get(l), "PARA", 2);
        const equipment = f.items("equipment");
        if (f.v("principle") || equipment.length || f.v("materials") || f.v("protocol")) {
            d.heading(t("Matériels et méthodes", "Materials and methods", "الأدوات والطرق").get(l));
            d.rubric(f.values, "principle", t("Principe", "Principle", "المبدأ").get(l), "PARA", 2);
            if (equipment.length) {
                d.heading(t("Matériels", "Materials", "الأدوات").get(l), 2);
                for (const e of equipment) {
                    const name = String(e.name || "").trim(), desc = String(e.desc || "").trim();
                    d.add(Block.bullets([[name, desc].filter((x) => x).join(" : ")]));
                    d.add(Block.slot(e.photo || "", name));
                }
            }
            d.rubric(f.values, "materials", t("Matériels", "Materials", "الأدوات").get(l), "BULLETS", 2);
            d.rubric(f.values, "protocol", t("Méthode", "Method", "الطريقة").get(l), "NUMBERED", 2);
        }
        const tables = f.items("tables");
        if (tables.length || f.v("measures") || f.v("results") || f.v("analysis") || hasImg(f.values, "results") || hasImg(f.values, "analysis")) {
            d.heading(t("Résultats et interprétation", "Results and interpretation", "النتائج والتفسير").get(l));
            let n = 0;
            for (const tb of tables) {
                const rowsMode = String(tb.layout || "") !== "1";
                const block = measureTable(rowsMode ? tb.data : tb.data_cols, rowsMode, tb.calc);
                if (!block) continue;
                n++;
                const title = String(tb.title || "").trim();
                d.add(Block.para(t("Tableau", "Table", "جدول").get(l) + " " + n + (title ? " : " + title : ""), "CENTER", true).size(10));
                d.add(block);
            }
            d.content(f.values, "measures", "TABLE");
            d.content(f.values, "results");
            d.rubric(f.values, "analysis", t("Interprétation", "Interpretation", "التفسير").get(l), "PARA", 2);
        }
        d.rubric(f.values, "applications", t("Quelques applications", "Some applications", "بعض التطبيقات").get(l), "RICH");
        d.rubric(f.values, "conclusion", t("Conclusion", "Conclusion", "خاتمة").get(l));
        d.rubric(f.values, "references", t("Bibliographie", "Bibliography", "المراجع").get(l), "BULLETS");
        return d;
    },
};

const STAGE = {
    id: "stage", module: "REPORTS", coverFields: COVER, defaultCoverModel: 1, supportsCover: true, defaultCover: true, formats: ALL,
    title: t("Rapport de stage", "Internship report", "تقرير تدريب"),
    description: t("Entreprise, missions, compétences acquises", "Company, tasks, skills gained", "المؤسسة، المهام، المهارات المكتسبة"),
    groups: [FIGURES],
    fields: [
        F("institution", L_INSTITUTION),
        F("company", t("Entreprise d'accueil", "Host company", "المؤسسة المستقبِلة"), { required: true }),
        F("title", L_TITLE, { defT: t("Rapport de stage", "Internship report", "تقرير تدريب") }),
        F("author", t("Stagiaire", "Intern", "المتدرب"), { required: true }),
        F("tutor", t("Maître de stage", "Company tutor", "مشرف التدريب في المؤسسة")),
        F("supervisor", t("Encadrant académique", "Academic supervisor", "المشرف الأكاديمي")),
        F("period", t("Période du stage", "Internship period", "فترة التدريب")),
        date(),
        F("thanks", t("Remerciements", "Acknowledgements", "شكر وتقدير"), { type: ML }),
        F("intro", L_INTRO, { type: ML }),
        F("presentation", t("Présentation de l'entreprise", "About the company", "تقديم المؤسسة"), { type: ML }),
        F("missions", t("Missions réalisées", "Tasks carried out", "المهام المنجزة"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("details", t("Déroulement du stage", "How the internship went", "سير التدريب"), { type: ML }),
        F("skills", t("Compétences acquises", "Skills gained", "المهارات المكتسبة"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("difficulties", t("Difficultés rencontrées", "Difficulties encountered", "الصعوبات"), { type: ML }),
        F("conclusion", L_CONCLUSION, { type: ML }),
    ],
    build(f, c) {
        const l = c.lang;
        const extra = join([
            labelled(t("Entreprise", "Company", "المؤسسة").get(l), f.v("company")),
            labelled(t("Maître de stage", "Company tutor", "مشرف التدريب").get(l), f.v("tutor")),
            labelled(t("Encadrant académique", "Academic supervisor", "المشرف الأكاديمي").get(l), f.v("supervisor")),
            labelled(t("Période", "Period", "الفترة").get(l), f.v("period")),
        ], "\n");
        const d = cover(f, l, { title: f.v("title"), subtitle: f.v("company"), author: f.v("author"), institution: f.v("institution"), extra, date: f.v("date") });
        if (!d.cover) { d.docTitle(f.v("title")); d.line(f.v("company"), "CENTER", true); d.line(f.v("author"), "CENTER"); d.line(f.v("period"), "CENTER"); }
        d.rubric(f.values, "thanks", t("Remerciements", "Acknowledgements", "شكر وتقدير").get(l));
        d.rubric(f.values, "intro", L_INTRO.get(l));
        d.rubric(f.values, "presentation", t("Présentation de l'entreprise", "About the company", "تقديم المؤسسة").get(l));
        d.rubric(f.values, "missions", t("Missions réalisées", "Tasks carried out", "المهام المنجزة").get(l), "BULLETS");
        d.rubric(f.values, "details", t("Déroulement du stage", "How the internship went", "سير التدريب").get(l));
        d.rubric(f.values, "skills", t("Compétences acquises", "Skills gained", "المهارات المكتسبة").get(l), "BULLETS");
        d.rubric(f.values, "difficulties", t("Difficultés rencontrées", "Difficulties encountered", "الصعوبات").get(l));
        d.rubric(f.values, "conclusion", L_CONCLUSION.get(l));
        return d;
    },
};

const ACTIVITE = {
    id: "activites", module: "REPORTS", coverFields: COVER, supportsCover: true, defaultCover: true, formats: ALL,
    title: t("Rapport d'activités", "Activity report", "تقرير أنشطة"),
    description: t("Bilan d'une période, activités, indicateurs", "Period review, activities, indicators", "حصيلة فترة، أنشطة، مؤشرات"),
    fields: [
        F("org", L_ORG, { required: true }),
        F("title", L_TITLE, { defT: t("Rapport d'activités", "Activity report", "تقرير أنشطة") }),
        F("period", t("Période couverte", "Period covered", "الفترة المعنية"), { required: true }),
        F("author", t("Rédigé par", "Written by", "إعداد")),
        date(),
        F("summary", t("Résumé", "Summary", "ملخص"), { type: ML }),
        F("indicators", t("Indicateurs (tableau)", "Indicators (table)", "المؤشرات (جدول)"), { type: ML, hint: H_TABLE }),
        F("challenges", t("Difficultés", "Challenges", "الصعوبات"), { type: ML }),
        F("next", t("Perspectives", "Next steps", "الآفاق"), { type: LIST, hint: H_ONE_PER_LINE }),
    ],
    groups: [
        G("activities", t("Activités menées", "Activities", "الأنشطة المنجزة"), t("Activité", "Activity", "نشاط"), [
            F("name", t("Intitulé", "Name", "العنوان"), { required: true }),
            F("when", t("Date / période", "Date / period", "التاريخ / الفترة")),
            F("desc", t("Description", "Description", "الوصف"), { type: ML }),
            F("result", t("Résultats obtenus", "Results", "النتائج"), { type: ML }),
        ]),
        FIGURES,
    ],
    build(f, c) {
        const l = c.lang;
        const d = cover(f, l, { title: f.v("title"), subtitle: f.v("period"), author: f.v("author"), institution: f.v("org"), date: f.v("date") });
        if (!d.cover) { d.docTitle(f.v("title")); d.line(f.v("org"), "CENTER", true); d.line(f.v("period"), "CENTER"); }
        d.rubric(f.values, "summary", t("Résumé", "Summary", "ملخص").get(l));
        const acts = f.items("activities");
        if (acts.length) d.heading(t("Activités menées", "Activities", "الأنشطة المنجزة").get(l));
        acts.forEach((a, i) => {
            d.heading(`${i + 1}. ${a.name || ""}`, 2);
            if (String(a.when || "").trim()) { d.line(a.when); d.last().setMuted().setItalic(); }
            d.content(a, "desc");
            if (String(a.result || "").trim()) d.line(t("Résultats :", "Results:", "النتائج:").get(l), "LEFT", true);
            d.content(a, "result");
        });
        d.rubric(f.values, "indicators", t("Indicateurs", "Indicators", "المؤشرات").get(l), "TABLE");
        d.rubric(f.values, "challenges", t("Difficultés", "Challenges", "الصعوبات").get(l));
        d.rubric(f.values, "next", t("Perspectives", "Next steps", "الآفاق").get(l), "BULLETS");
        return d;
    },
};

const TPE_MEMBERS = membersGroup(t("Participants", "Participants", "المشاركون"));

const TPE = {
    id: "tpe", module: "REPORTS", coverFields: COVER, defaultCoverModel: 1, supportsCover: true, defaultCover: true, formats: ALL,
    title: t("Exposé écrit / TPE", "Written report / essay", "عرض مكتوب / بحث"),
    description: t("Plan de travail, introduction, parties, conclusion", "Outline, introduction, parts, conclusion", "خطة العمل، مقدمة، أجزاء، خاتمة"),
    fields: [
        F("institution", L_INSTITUTION),
        F("title", t("Intitulé", "Heading", "العنوان"), { required: true, defT: t("EXPOSÉ DE …", "REPORT ON …", "عرض حول …") }),
        F("theme", t("Thème", "Topic", "الموضوع"), { required: true }),
        date(),
        F("intro", L_INTRO, { type: ML }),
        F("conclusion", L_CONCLUSION, { type: ML }),
        F("references", t("Références", "References", "المراجع"), { type: LIST, hint: H_ONE_PER_LINE }),
    ],
    groups: [
        TPE_MEMBERS,
        G("parts", t("Parties", "Parts", "الأجزاء"), t("Partie", "Part", "جزء"), [
            F("title", t("Titre de la partie", "Part title", "عنوان الجزء"), { required: true }),
            F("content", t("Contenu", "Content", "المحتوى"), { type: ML,
                hint: t("Commence une ligne par # pour un sous-titre, par - pour une puce.", "Start a line with # for a subheading, - for a bullet.", "ابدأ السطر بـ # لعنوان فرعي، وبـ - لنقطة.") }),
        ], { minItems: 1, startItems: 3 }),
        FIGURES,
    ],
    build(f, c) {
        const l = c.lang;
        const d = cover(f, l, { title: f.v("title"), subtitle: f.v("theme"), author: memberNames(f, TPE_MEMBERS, f.v("authors")), institution: f.v("institution"), date: f.v("date") });
        applyMembers(d, f, TPE_MEMBERS, l, f.v("authors"));
        d.pageBorder = f.cover && f.v("cv_border") === "1";
        if (!d.cover) {
            d.docTitle(f.v("title")); d.line(f.v("theme"), "CENTER", true);
            if (d.members.length) d.add(Block.table(d.memberHeader, d.members)); else d.line(lines(d.author).join(", "), "CENTER");
        }
        d.rubric(f.values, "intro", L_INTRO.get(l));
        f.items("parts").forEach((p) => { d.heading(p.title || ""); d.content(p, "content", "RICH"); });
        d.rubric(f.values, "conclusion", L_CONCLUSION.get(l));
        d.rubric(f.values, "references", t("Références", "References", "المراجع").get(l), "BULLETS");
        return d;
    },
};

const REUNION = {
    id: "reunion", module: "REPORTS", formats: ALL,
    title: t("Compte rendu de réunion", "Meeting minutes", "محضر اجتماع"),
    description: t("Participants, ordre du jour, décisions, actions", "Attendees, agenda, decisions, actions", "الحضور، جدول الأعمال، القرارات، المهام"),
    fields: [
        F("org", L_ORG),
        F("subject", t("Objet de la réunion", "Meeting subject", "موضوع الاجتماع"), { required: true }),
        date(),
        F("place", t("Lieu", "Place", "المكان")),
        F("chair", t("Présidée par", "Chaired by", "برئاسة")),
        F("attendees", t("Participants", "Attendees", "الحاضرون"), { type: LIST, hint: H_AUTHORS }),
        F("absents", t("Absents / excusés", "Absent / apologies", "الغائبون"), { type: LIST, hint: H_AUTHORS }),
        F("agenda", t("Ordre du jour", "Agenda", "جدول الأعمال"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("decisions", t("Décisions prises", "Decisions", "القرارات المتخذة"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("next", t("Prochaine réunion", "Next meeting", "الاجتماع القادم")),
        F("secretary", t("Rédigé par", "Minutes taken by", "حرّره")),
    ],
    groups: [
        G("points", t("Points discutés", "Discussion points", "النقاط المناقشة"), t("Point", "Point", "نقطة"), [
            F("title", t("Point", "Point", "النقطة"), { required: true }),
            F("content", t("Échanges", "Discussion", "المناقشة"), { type: ML }),
        ]),
        G("actions", t("Actions à mener", "Action items", "المهام المطلوبة"), t("Action", "Action", "مهمة"), [
            F("task", t("Tâche", "Task", "المهمة"), { required: true }),
            F("owner", t("Responsable", "Owner", "المسؤول")),
            F("deadline", t("Échéance", "Deadline", "الأجل")),
        ], { startItems: 0 }),
        FIGURES,
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.line(f.v("org").toUpperCase(), "CENTER", true);
        d.docTitle(t("Compte rendu de réunion", "Meeting minutes", "محضر اجتماع").get(l));
        d.line(f.v("subject"), "CENTER", true);
        d.add(Block.divider());
        d.line(labelled(L_DATE.get(l), f.v("date")));
        d.line(labelled(t("Lieu", "Place", "المكان").get(l), f.v("place")));
        d.line(labelled(t("Présidée par", "Chaired by", "برئاسة").get(l), f.v("chair")));
        d.rubric(f.values, "attendees", t("Participants", "Attendees", "الحاضرون").get(l), "BULLETS", 2);
        d.rubric(f.values, "absents", t("Absents / excusés", "Absent / apologies", "الغائبون").get(l), "BULLETS", 2);
        d.rubric(f.values, "agenda", t("Ordre du jour", "Agenda", "جدول الأعمال").get(l), "NUMBERED");
        const pts = f.items("points");
        if (pts.length) d.heading(t("Déroulement", "Discussion", "سير الاجتماع").get(l));
        pts.forEach((p, i) => { d.heading(`${i + 1}. ${p.title || ""}`, 2); d.content(p, "content"); });
        d.rubric(f.values, "decisions", t("Décisions prises", "Decisions", "القرارات المتخذة").get(l), "BULLETS");
        const acts = f.items("actions");
        if (acts.length) {
            d.heading(t("Actions à mener", "Action items", "المهام المطلوبة").get(l));
            d.add(Block.table([t("Tâche", "Task", "المهمة").get(l), t("Responsable", "Owner", "المسؤول").get(l), t("Échéance", "Deadline", "الأجل").get(l)],
                acts.map((a) => [a.task || "", a.owner || "", a.deadline || ""])));
        }
        d.line(labelled(t("Prochaine réunion", "Next meeting", "الاجتماع القادم").get(l), f.v("next")), "LEFT", true);
        if (f.v("secretary")) { d.add(Block.spacer()); d.line(labelled(t("Rédigé par", "Minutes taken by", "حرّره").get(l), f.v("secretary")), "RIGHT"); }
        return d;
    },
};

// ============================================================ 2. CV ET CANDIDATURES

const CV = {
    id: "cv", module: "CV", formats: ALL,
    title: t("CV", "CV / résumé", "سيرة ذاتية"),
    description: t("Profil, expériences, formations, compétences", "Profile, experience, education, skills", "الملف، الخبرات، التكوين، المهارات"),
    fields: [
        F("name", t("Nom complet", "Full name", "الاسم الكامل"), { required: true }),
        F("job", t("Poste recherché / titre", "Job title", "المنصب / الصفة")),
        F("phone", t("Téléphone", "Phone", "الهاتف"), { type: "PHONE" }),
        F("email", t("E-mail", "Email", "البريد الإلكتروني"), { type: "EMAIL" }),
        F("address", t("Adresse / ville", "Address / city", "العنوان / المدينة")),
        F("profile", t("Profil (quelques lignes sur toi)", "Profile (a few lines about you)", "نبذة عنك (بضعة أسطر)"), { type: ML }),
        F("skills", t("Compétences", "Skills", "المهارات"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("languages", t("Langues", "Languages", "اللغات"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("interests", t("Centres d'intérêt", "Interests", "الاهتمامات"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("references", t("Références", "References", "المراجع"), { type: ML }),
    ],
    groups: [
        G("experience", t("Expériences professionnelles", "Work experience", "الخبرات المهنية"), t("Expérience", "Experience", "خبرة"), [
            F("role", t("Poste", "Position", "المنصب"), { required: true }),
            F("company", t("Entreprise / structure", "Company", "المؤسسة")),
            F("period", t("Période", "Period", "الفترة")),
            F("desc", t("Tâches et réalisations", "Tasks and achievements", "المهام والإنجازات"), { type: LIST, hint: H_ONE_PER_LINE }),
        ]),
        G("education", t("Formations", "Education", "التكوين"), t("Formation", "Degree", "تكوين"), [
            F("degree", t("Diplôme / formation", "Degree / course", "الشهادة / التكوين"), { required: true }),
            F("school", t("Établissement", "School", "المؤسسة")),
            F("period", t("Année(s)", "Year(s)", "السنة (السنوات)")),
            F("details", t("Détails (mention, spécialité…)", "Details (honours, major…)", "تفاصيل (التقدير، التخصص…)")),
        ]),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.add(Block.heading(f.v("name"), 0).size(26).setAlign("LEFT"));
        if (f.v("job")) d.add(Block.para(f.v("job"), "LEFT", true).setAccent().size(14));
        const contacts = join([f.v("phone"), f.v("email"), f.v("address")], "  •  ");
        if (contacts) d.add(Block.para(contacts, "LEFT", false).setMuted());
        d.add(Block.divider());
        d.rubric(f.values, "profile", t("Profil", "Profile", "الملف الشخصي").get(l));
        const exp = f.items("experience");
        if (exp.length) d.heading(t("Expériences professionnelles", "Work experience", "الخبرات المهنية").get(l));
        exp.forEach((e) => {
            d.add(Block.para(join([e.role || "", e.company || ""], " — "), "LEFT", true));
            if (String(e.period || "").trim()) d.add(Block.para(e.period, "LEFT", false).setMuted().setItalic());
            d.bullets(e.desc || "");
        });
        const edu = f.items("education");
        if (edu.length) d.heading(t("Formations", "Education", "التكوين").get(l));
        edu.forEach((e) => {
            d.add(Block.para(join([e.degree || "", e.school || ""], " — "), "LEFT", true));
            const sub = join([e.period || "", e.details || ""], " • ");
            if (sub) d.add(Block.para(sub, "LEFT", false).setMuted());
        });
        d.rubric(f.values, "skills", t("Compétences", "Skills", "المهارات").get(l), "BULLETS");
        d.rubric(f.values, "languages", t("Langues", "Languages", "اللغات").get(l), "BULLETS");
        d.rubric(f.values, "interests", t("Centres d'intérêt", "Interests", "الاهتمامات").get(l), "BULLETS");
        d.rubric(f.values, "references", t("Références", "References", "المراجع").get(l));
        return d;
    },
};

const LETTER_CLOSING = t(
    "Veuillez agréer, Madame, Monsieur, l'expression de ma haute considération.", "Yours faithfully,", "وتفضلوا بقبول فائق عبارات التقدير والاحترام.");
const H_BODY = t("Laisse une ligne entre chaque paragraphe", "Leave a line between paragraphs", "اترك سطرًا بين كل فقرة");
const SALUTATION = t("Madame, Monsieur,", "Dear Sir or Madam,", "سيدي، سيدتي،");

const MOTIVATION = {
    id: "motivation", module: "CV", formats: ALL,
    title: t("Lettre de motivation", "Cover letter", "رسالة تحفيز"),
    description: t("Candidature à un emploi, un stage, une école", "Job, internship or school application", "ترشح لوظيفة أو تدريب أو مدرسة"),
    fields: [
        F("sender", t("Ton nom", "Your name", "اسمك"), { required: true }),
        F("sender_address", t("Ton adresse", "Your address", "عنوانك"), { type: ML }),
        F("sender_phone", t("Téléphone", "Phone", "الهاتف"), { type: "PHONE" }),
        F("sender_email", t("E-mail", "Email", "البريد الإلكتروني"), { type: "EMAIL" }),
        F("recipient", t("Destinataire", "Recipient", "المرسل إليه"), { type: ML }),
        F("city", L_CITY),
        date(),
        F("subject", t("Objet", "Subject", "الموضوع"), { required: true, defT: t("Candidature au poste de …", "Application for the position of …", "طلب ترشح لمنصب …") }),
        F("salutation", t("Formule d'appel", "Salutation", "عبارة الافتتاح"), { defT: SALUTATION }),
        F("body", t("Corps de la lettre", "Letter body", "نص الرسالة"), { type: ML, hint: H_BODY, required: true }),
        F("closing", t("Formule de politesse", "Closing", "عبارة الختام"), { type: ML, defT: t(
            "Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
            "Thank you for your time and consideration. I look forward to hearing from you.\n\nYours faithfully,",
            "وفي انتظار ردكم، تقبلوا مني فائق عبارات التقدير والاحترام.") }),
        F("attachments", t("Pièces jointes", "Enclosures", "المرفقات"), { type: LIST, hint: H_ONE_PER_LINE }),
    ],
    build: (f, c) => letter(f, c.lang, { sender: f.v("sender"), senderLines: [f.v("sender_address"), f.v("sender_phone"), f.v("sender_email")],
        recipient: f.v("recipient"), reference: "", signName: f.v("sender"), signFunction: "", copies: "" }),
};

// ============================================================ 3. EXPOSÉS ET PRÉSENTATIONS

const EXPOSE_MEMBERS = membersGroup(t("Présenté par", "Presented by", "تقديم"));

const EXPOSE = {
    id: "expose", module: "SLIDES", formats: SLIDES,
    title: t("Exposé / présentation", "Talk / presentation", "عرض تقديمي"),
    description: t("Diapositives PowerPoint prêtes à présenter", "Ready-to-present PowerPoint slides", "شرائح باوربوينت جاهزة للعرض"),
    fields: [
        F("institution", L_INSTITUTION),
        F("title", t("Titre de l'exposé", "Talk title", "عنوان العرض"), { required: true }),
        F("subtitle", L_SUBTITLE),
        F("teacher", t("Sous la supervision de", "Supervised by", "تحت إشراف")),
        date(),
        F("closing", t("Diapositive de fin", "Closing slide", "الشريحة الأخيرة"), { defT: t("Merci de votre attention", "Thank you for your attention", "شكرًا على حسن انتباهكم") }),
    ],
    groups: [
        EXPOSE_MEMBERS,
        G("slides", t("Diapositives", "Slides", "الشرائح"), t("Diapositive", "Slide", "شريحة"), [
            F("title", t("Titre de la diapositive", "Slide title", "عنوان الشريحة"), { required: true }),
            F("points", t("Points clés", "Key points", "النقاط الرئيسية"), { type: LIST, hint: H_ONE_PER_LINE }),
        ], { minItems: 1, startItems: 3 }),
        FIGURES,
    ],
    build(f, c) {
        const d = base(f);
        d.title = f.v("title"); d.subtitle = f.v("subtitle"); d.institution = f.v("institution"); d.date = f.v("date");
        const [mh, mr] = members(f, EXPOSE_MEMBERS, c.lang);
        d.author = [...lines(memberNames(f, EXPOSE_MEMBERS, f.v("authors"))), ...(f.v("teacher") ? [labelled(t("Supervision", "Supervisor", "إشراف").get(c.lang), f.v("teacher"))] : [])].join("\n");
        for (const s of f.items("slides")) {
            const sl = new Slide(s.title || "", lines(s.points || ""));
            sl.imageRef = s[imgKey("points")] || "";
            if (sl.imageRef.trim()) sl.legend = s[capKey("points")] || "";
            d.slides.push(sl);
        }
        const people = lines(memberNames(f, EXPOSE_MEMBERS, f.v("authors")));
        const titles = f.items("slides").map((s) => String(s.title || "").trim()).filter((x) => x);
        let at = 0;
        const partTitle = t("NOMS DES PARTICIPANTS", "PARTICIPANTS", "أسماء المشاركين").get(c.lang);
        if (mr.length && mh.length) { const ps = new Slide(partTitle, []); ps.tableHeader = mh; ps.tableRows = mr; d.slides.splice(at++, 0, ps); }
        else if (people.length >= 2) d.slides.splice(at++, 0, new Slide(partTitle, people));
        if (titles.length >= 3) d.slides.splice(at, 0, new Slide(t("PLAN DE TRAVAIL", "OUTLINE", "خطة العمل").get(c.lang), titles));
        if (f.v("closing")) d.slides.push(Slide.statement(f.v("closing")));
        return d;
    },
};

const PITCH = {
    id: "pitch", module: "SLIDES", formats: SLIDES,
    title: t("Pitch de projet", "Project pitch", "عرض مشروع"),
    description: t("Problème, solution, marché, modèle économique", "Problem, solution, market, business model", "المشكلة، الحل، السوق، النموذج الاقتصادي"),
    groups: [FIGURES],
    fields: [
        F("name", t("Nom du projet", "Project name", "اسم المشروع"), { required: true }),
        F("tagline", t("Accroche (une phrase)", "Tagline (one sentence)", "شعار (جملة واحدة)")),
        F("author", t("Porteur du projet", "Founder", "صاحب المشروع")),
        date(),
        F("problem", t("Le problème", "The problem", "المشكلة"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("solution", t("Notre solution", "Our solution", "حلّنا"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("market", t("Marché et clients cibles", "Market and target customers", "السوق والعملاء المستهدفون"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("model", t("Modèle économique", "Business model", "النموذج الاقتصادي"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("competition", t("Concurrence et avantages", "Competition and edge", "المنافسة والمزايا"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("team", t("L'équipe", "The team", "الفريق"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("needs", t("Nos besoins", "What we need", "احتياجاتنا"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("contact", t("Contact", "Contact", "التواصل")),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.title = f.v("name"); d.subtitle = f.v("tagline"); d.author = f.v("author"); d.date = f.v("date");
        [["problem", t("Le problème", "The problem", "المشكلة")],
            ["solution", t("Notre solution", "Our solution", "حلّنا")],
            ["market", t("Marché et clients", "Market and customers", "السوق والعملاء")],
            ["model", t("Modèle économique", "Business model", "النموذج الاقتصادي")],
            ["competition", t("Concurrence et avantages", "Competition and edge", "المنافسة والمزايا")],
            ["team", t("L'équipe", "The team", "الفريق")],
            ["needs", t("Nos besoins", "What we need", "احتياجاتنا")]].forEach(([id, label]) => {
            if (lines(f.v(id)).length || hasImg(f.values, id)) {
                const s = new Slide(label.get(l), lines(f.v(id)));
                s.imageRef = f.values[imgKey(id)] || "";
                if (s.imageRef.trim()) s.legend = f.values[capKey(id)] || "";
                d.slides.push(s);
            }
        });
        d.slides.push(Slide.statement(join([t("Merci !", "Thank you!", "شكرًا!").get(l), f.v("contact")], "\n")));
        return d;
    },
};

// ============================================================ 4. LETTRES ET ADMINISTRATIF

const LETTRE = {
    id: "lettre", module: "LETTERS", formats: ALL,
    title: t("Lettre officielle / demande", "Formal letter / request", "رسالة رسمية / طلب"),
    description: t("Demandes, requêtes, courriers administratifs", "Requests, applications, official mail", "طلبات، التماسات، مراسلات إدارية"),
    fields: [
        F("sender", t("Expéditeur (nom)", "Sender (name)", "المرسل (الاسم)"), { required: true }),
        F("sender_function", t("Fonction / qualité", "Position / title", "الصفة")),
        F("sender_address", t("Adresse de l'expéditeur", "Sender address", "عنوان المرسل"), { type: ML }),
        F("sender_phone", t("Téléphone", "Phone", "الهاتف"), { type: "PHONE" }),
        F("sender_email", t("E-mail", "Email", "البريد الإلكتروني"), { type: "EMAIL" }),
        F("recipient", t("Destinataire", "Recipient", "المرسل إليه"), { type: ML, required: true }),
        F("city", L_CITY),
        date(),
        F("reference", t("Référence (facultatif)", "Reference (optional)", "المرجع (اختياري)")),
        F("subject", t("Objet", "Subject", "الموضوع"), { required: true }),
        F("salutation", t("Formule d'appel", "Salutation", "عبارة الافتتاح"), { defT: SALUTATION }),
        F("body", t("Corps de la lettre", "Letter body", "نص الرسالة"), { type: ML, hint: H_BODY, required: true }),
        F("closing", t("Formule de politesse", "Closing", "عبارة الختام"), { type: ML, defT: LETTER_CLOSING }),
        F("attachments", t("Pièces jointes", "Enclosures", "المرفقات"), { type: LIST, hint: H_ONE_PER_LINE }),
        F("copies", t("Copies (ampliations)", "Copies to", "نسخ إلى"), { type: LIST, hint: H_ONE_PER_LINE }),
    ],
    build: (f, c) => letter(f, c.lang, { sender: f.v("sender"), senderLines: [f.v("sender_function"), f.v("sender_address"), f.v("sender_phone"), f.v("sender_email")],
        recipient: f.v("recipient"), reference: f.v("reference"), signName: f.v("sender"), signFunction: f.v("sender_function"), copies: f.v("copies") }),
};

const ATTESTATION = {
    id: "attestation", module: "LETTERS", formats: ALL,
    title: t("Attestation / déclaration", "Certificate / statement", "شهادة / تصريح"),
    description: t("Attestation de travail, de stage, sur l'honneur…", "Employment, internship, sworn statement…", "شهادة عمل، تدريب، تصريح بالشرف…"),
    fields: [
        F("org", t("Organisme émetteur", "Issuing organisation", "الجهة المصدرة"), { required: true }),
        F("org_details", t("Adresse et contacts de l'organisme", "Organisation address and contacts", "عنوان الجهة ووسائل الاتصال"), { type: ML }),
        F("doc_title", L_TITLE, { defT: t("ATTESTATION", "CERTIFICATE", "شهادة") }),
        F("number", t("Numéro (facultatif)", "Number (optional)", "الرقم (اختياري)")),
        F("signatory", t("Nom du signataire", "Signatory name", "اسم الموقّع"), { required: true }),
        F("signatory_function", t("Fonction du signataire", "Signatory position", "صفة الموقّع"), { required: true }),
        F("body", t("Texte de l'attestation", "Certificate text", "نص الشهادة"), { type: ML, required: true }),
        F("purpose", t("Formule finale", "Closing statement", "العبارة الختامية"), { type: ML, defT: t(
            "En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.",
            "This certificate is issued for whatever legal purpose it may serve.",
            "سُلّمت هذه الشهادة للإدلاء بها عند الحاجة.") }),
        F("city", L_CITY),
        date(),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.line(f.v("org").toUpperCase(), "LEFT", true);
        if (f.v("org_details")) { d.para(f.v("org_details")); d.last().align = "LEFT"; d.last().setMuted(); }
        if (f.v("number")) d.line(`N° ${f.v("number")}`, "LEFT");
        d.add(Block.spacer()); d.add(Block.spacer());
        d.docTitle(f.v("doc_title") || "ATTESTATION", 22);
        d.add(Block.spacer());
        d.content(f.values, "body");
        d.para(f.v("purpose"));
        d.add(Block.spacer());
        d.line(placeDate(l, f.v("city"), f.v("date")), "RIGHT");
        d.add(Block.spacer());
        d.line(f.v("signatory_function"), "RIGHT", true);
        d.add(Block.spacer()); d.add(Block.spacer());
        d.line(f.v("signatory"), "RIGHT", true);
        return d;
    },
};

const NOTE = {
    id: "note", module: "LETTERS", formats: ALL,
    title: t("Note de service", "Internal memo", "مذكرة مصلحية"),
    description: t("Communication interne d'une structure", "Internal communication", "تواصل داخلي في المؤسسة"),
    fields: [
        F("org", L_ORG, { required: true }),
        F("service", t("Direction / service émetteur", "Issuing department", "المديرية / المصلحة المصدرة")),
        F("number", t("N° de la note", "Memo number", "رقم المذكرة")),
        F("city", L_CITY),
        date(),
        F("recipients", t("Destinataires", "To", "إلى"), { defT: t("À l'ensemble du personnel", "All staff", "إلى كافة الموظفين") }),
        F("subject", t("Objet", "Subject", "الموضوع"), { required: true }),
        F("body", t("Contenu", "Content", "المحتوى"), { type: ML, required: true }),
        F("signatory", t("Signataire", "Signatory", "الموقّع")),
        F("signatory_function", t("Fonction", "Position", "الصفة")),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.line(f.v("org").toUpperCase(), "LEFT", true);
        d.line(f.v("service"), "LEFT");
        d.line(placeDate(l, f.v("city"), f.v("date")), "RIGHT");
        d.add(Block.spacer());
        d.docTitle(t("NOTE DE SERVICE", "INTERNAL MEMO", "مذكرة مصلحية").get(l) + (f.v("number") ? ` N° ${f.v("number")}` : ""), 18);
        d.add(Block.divider());
        d.line(labelled(t("Destinataires", "To", "إلى").get(l), f.v("recipients")), "LEFT", true);
        d.line(labelled(t("Objet", "Subject", "الموضوع").get(l), f.v("subject")), "LEFT", true);
        d.add(Block.spacer());
        d.content(f.values, "body");
        d.add(Block.spacer());
        d.line(f.v("signatory_function"), "RIGHT", true);
        d.add(Block.spacer());
        d.line(f.v("signatory"), "RIGHT", true);
        return d;
    },
};

// ============================================================ 5. FORMULAIRES ET FICHES

const FICHE = {
    id: "fiche", module: "FORMS", formats: ALL,
    title: t("Fiche de renseignements", "Information sheet", "استمارة معلومات"),
    description: t("Fiche imprimable à remplir à la main", "Printable sheet to fill in by hand", "استمارة للطباعة تُملأ باليد"),
    fields: [
        F("org", L_ORG),
        F("title", L_TITLE, { required: true, defT: t("Fiche de renseignements", "Information sheet", "استمارة معلومات") }),
        F("intro", t("Consigne (facultatif)", "Instructions (optional)", "تعليمات (اختياري)"), { type: ML }),
        F("fields", t("Champs à remplir", "Fields to fill in", "الحقول المطلوبة"), { type: LIST, required: true,
            hint: t("Un champ par ligne. Commence une ligne par # pour créer une rubrique.", "One field per line. Start a line with # to create a section.", "حقل واحد في كل سطر. ابدأ السطر بـ # لإنشاء قسم."),
            defT: t(
                "# Identité\nNom\nPrénom(s)\nDate et lieu de naissance\nSexe\nNationalité\n# Coordonnées\nAdresse\nTéléphone\nE-mail\n# Situation\nProfession\nNiveau d'études",
                "# Identity\nSurname\nFirst name(s)\nDate and place of birth\nGender\nNationality\n# Contact details\nAddress\nPhone\nEmail\n# Situation\nOccupation\nEducation level",
                "# الهوية\nاللقب\nالاسم\nتاريخ ومكان الميلاد\nالجنس\nالجنسية\n# معلومات الاتصال\nالعنوان\nالهاتف\nالبريد الإلكتروني\n# الوضعية\nالمهنة\nالمستوى الدراسي") }),
        F("signature", t("Zone de signature", "Signature area", "خانة التوقيع"), { type: "CHOICE", options: [t("Oui", "Yes", "نعم"), t("Non", "No", "لا")] }),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        d.line(f.v("org").toUpperCase(), "CENTER", true);
        d.docTitle(f.v("title"));
        if (f.v("intro")) { d.para(f.v("intro")); d.last().setItalic(); }
        d.slot(f.values, "intro");
        f.v("fields").split("\n").map((x) => x.trim()).filter((x) => x).forEach((x) => {
            if (x.startsWith("#")) d.heading(x.replace(/^#+/, "").trim(), 2); else d.add(Block.field(x, 1));
        });
        if (f.choice("signature") === 0) {
            d.add(Block.spacer());
            d.line(t("Fait à ………………………, le ……………………", "Done at ………………………, on ……………………", "حُرّر في ………………………، بتاريخ ……………………").get(l), "RIGHT");
            d.line(t("Signature", "Signature", "التوقيع").get(l), "RIGHT", true);
        }
        return d;
    },
};

const QUESTIONNAIRE = {
    id: "questionnaire", module: "FORMS", formats: ALL,
    title: t("Questionnaire", "Questionnaire", "استبيان"),
    description: t("Questions à choix ou à réponse libre", "Multiple-choice or open questions", "أسئلة اختيار أو أسئلة مفتوحة"),
    fields: [
        F("org", L_ORG),
        F("title", L_TITLE, { required: true }),
        F("intro", t("Introduction / consigne", "Introduction / instructions", "مقدمة / تعليمات"), { type: ML }),
        F("thanks", t("Message de fin", "Closing message", "رسالة الختام"), { defT: t("Merci pour votre participation !", "Thank you for taking part!", "شكرًا على مشاركتكم!") }),
    ],
    groups: [
        G("questions", t("Questions", "Questions", "الأسئلة"), t("Question", "Question", "سؤال"), [
            F("q", t("Question", "Question", "السؤال"), { required: true }),
            F("options", t("Choix de réponse (laisser vide = réponse libre)", "Answer options (empty = open answer)", "خيارات الإجابة (فارغ = إجابة مفتوحة)"), { type: LIST, hint: H_ONE_PER_LINE }),
        ], { minItems: 1, startItems: 3 }),
    ],
    build(f) {
        const d = base(f);
        d.line(f.v("org").toUpperCase(), "CENTER", true);
        d.docTitle(f.v("title"));
        d.content(f.values, "intro");
        f.items("questions").forEach((q, i) => d.add(Block.choices(`${i + 1}. ${q.q || ""}`, lines(q.options || ""))));
        if (f.v("thanks")) { d.add(Block.spacer()); d.line(f.v("thanks"), "CENTER", true); }
        return d;
    },
};

const SUIVI = {
    id: "suivi", module: "FORMS", formats: ALL,
    title: t("Fiche de suivi", "Tracking sheet", "بطاقة متابعة"),
    description: t("Tableau vide à colonnes, prêt à imprimer", "Empty table with columns, ready to print", "جدول فارغ بأعمدة، جاهز للطباعة"),
    fields: [
        F("org", L_ORG),
        F("title", L_TITLE, { required: true, defT: t("Fiche de suivi", "Tracking sheet", "بطاقة متابعة") }),
        F("subtitle", t("Précision (période, classe, projet…)", "Details (period, class, project…)", "تفاصيل (الفترة، القسم، المشروع…)")),
        F("columns", t("Colonnes", "Columns", "الأعمدة"), { type: LIST, hint: H_ONE_PER_LINE, required: true,
            defT: t("N°\nDate\nActivité\nResponsable\nObservations\nSignature", "No.\nDate\nActivity\nOwner\nNotes\nSignature", "الرقم\nالتاريخ\nالنشاط\nالمسؤول\nملاحظات\nالتوقيع") }),
        F("rows", t("Nombre de lignes", "Number of rows", "عدد الأسطر"), { type: "NUMBER", def: "15" }),
        F("orientation", t("Orientation de la page", "Page orientation", "اتجاه الصفحة"), { type: "CHOICE", options: [t("Portrait", "Portrait", "عمودي"), t("Paysage", "Landscape", "أفقي")] }),
    ],
    build(f) {
        const d = base(f);
        d.landscape = f.choice("orientation") === 1;
        d.line(f.v("org").toUpperCase(), "CENTER", true);
        d.docTitle(f.v("title"));
        d.line(f.v("subtitle"), "CENTER");
        const cols = lines(f.v("columns"));
        const n = Math.min(200, Math.max(1, parseInt(f.v("rows"), 10) || 15));
        const numbered = ["N°", "No.", "الرقم"].includes(cols[0]);
        d.add(Block.table(cols, Array.from({ length: n }, (_, i) => cols.map((_, k) => (k === 0 && numbered ? String(i + 1) : "")))));
        return d;
    },
};

// ============================================================ 6. GRAPHIQUES ET TABLEAUX

const CHART = {
    id: "graphique", module: "CHARTS", formats: ["PNG", "PDF", "DOCX", "PPTX"],
    title: t("Graphique", "Chart", "رسم بياني"),
    description: t("Courbe, barres ou secteurs à partir de tes données", "Line, bar or pie chart from your data", "منحنى أو أعمدة أو دائرة من بياناتك"),
    fields: [
        F("title", t("Titre du graphique", "Chart title", "عنوان الرسم البياني"), { required: true }),
        F("type", t("Type de graphique", "Chart type", "نوع الرسم البياني"), { type: "CHOICE", options: CHART_TYPES }),
        F("x_label", t("Nom de l'axe horizontal (X)", "Horizontal axis name (X)", "اسم المحور الأفقي (س)")),
        F("y_label", t("Nom de l'axe vertical (Y)", "Vertical axis name (Y)", "اسم المحور العمودي (ص)")),
        F("comment", t("Commentaire / interprétation", "Comment / interpretation", "تعليق / تفسير"), { type: ML }),
    ],
    groups: [
        G("points", t("Données", "Data", "البيانات"), t("Point", "Point", "نقطة"), [
            F("x", t("X (abscisse ou catégorie)", "X (value or category)", "س (القيمة أو الفئة)"), { required: true }),
            F("y", t("Y (valeur)", "Y (value)", "ص (القيمة)"), { type: "NUMBER", required: true }),
        ], { minItems: 2, startItems: 4 }),
    ],
    build(f, c) {
        const l = c.lang;
        const d = base(f);
        const spec = chartSpec(f);
        const img = c.chart(spec);
        d.docTitle(f.v("title"));
        if (img) d.add(Block.image(img.png, img.width, img.height));
        d.heading(t("Données", "Data", "البيانات").get(l), 2);
        d.add(Block.table([f.v("x_label") || "X", f.v("y_label") || "Y"], spec.points.map((p) => [p[0], formatNumber(p[1])])));
        d.rubric(f.values, "comment", t("Interprétation", "Interpretation", "التفسير").get(l), "PARA", 2);
        d.title = f.v("title");
        const slide = new Slide(f.v("title"), lines(f.v("comment")));
        if (img) { slide.png = img.png; slide.pxW = img.width; slide.pxH = img.height; }
        d.slides.push(slide);
        return d;
    },
};

const TABLEAU = {
    id: "tableau", module: "CHARTS", formats: ALL,
    title: t("Tableau", "Table", "جدول"),
    description: t("Tableau organisé, prêt à insérer", "Organised table, ready to use", "جدول منظم جاهز للاستعمال"),
    fields: [
        F("title", L_TITLE, { required: true }),
        F("columns", t("Colonnes", "Columns", "الأعمدة"), { type: LIST, hint: H_ONE_PER_LINE, required: true }),
        F("note", t("Source / note", "Source / note", "المصدر / ملاحظة")),
    ],
    groups: [
        G("rows", t("Lignes du tableau", "Table rows", "أسطر الجدول"), t("Ligne", "Row", "سطر"), [
            F("cells", t("Valeurs (séparées par ;)", "Values (separated by ;)", "القيم (مفصولة بـ ;)"), { required: true }),
        ], { minItems: 1, startItems: 3 }),
    ],
    build(f) {
        const d = base(f);
        d.docTitle(f.v("title"));
        d.add(Block.table(lines(f.v("columns")), f.items("rows").map((r) => String(r.cells || "").split(";").map((x) => x.trim()))));
        if (f.v("note")) d.add(Block.para(f.v("note"), "LEFT", false).setMuted().setItalic());
        return d;
    },
};

// ------------------------------------------------------------ Registre

export const TYPES = [TPE, TP, STAGE, ACTIVITE, REUNION, CV, MOTIVATION, EXPOSE, PITCH, LETTRE, ATTESTATION, NOTE, FICHE, QUESTIONNAIRE, SUIVI, CHART, TABLEAU];
for (const ty of TYPES) { ty.groups = ty.groups || []; ty.coverFields = ty.coverFields || []; ty.defaultCoverModel = ty.defaultCoverModel || 0; }

export const typeById = (id) => TYPES.find((x) => x.id === id);
export const forModule = (m) => TYPES.filter((x) => x.module === m);

/** Construit le document à partir des données brutes (objet JSON). */
export function buildFrom(type, data, ctx) {
    return type.build(new Form(data), ctx);
}

export const MODULES = [
    { id: "REPORTS", icon: "report", title: t("Rapports et comptes rendus", "Reports and minutes", "التقارير والمحاضر"),
        sub: t("TP, stage, exposé écrit, réunion…", "Lab, internship, essay, meeting…", "أعمال تطبيقية، تدريب، بحث، اجتماع…") },
    { id: "CV", icon: "cv", title: t("CV et candidatures", "CVs and applications", "السير الذاتية والترشحات"),
        sub: t("CV, lettre de motivation", "CV, cover letter", "سيرة ذاتية، رسالة تحفيز") },
    { id: "SLIDES", icon: "slides", title: t("Exposés et présentations", "Talks and presentations", "العروض التقديمية"),
        sub: t("Diapositives PowerPoint", "PowerPoint slides", "شرائح باوربوينت") },
    { id: "LETTERS", icon: "letter", title: t("Lettres et administratif", "Letters and admin", "الرسائل والوثائق الإدارية"),
        sub: t("Demande, attestation, note de service", "Request, certificate, memo", "طلب، شهادة، مذكرة") },
    { id: "FORMS", icon: "form", title: t("Formulaires et fiches", "Forms and sheets", "الاستمارات والبطاقات"),
        sub: t("Fiche, questionnaire, suivi", "Sheet, questionnaire, tracking", "استمارة، استبيان، متابعة") },
    { id: "CHARTS", icon: "chart", title: t("Graphiques et tableaux", "Charts and tables", "الرسوم البيانية والجداول"),
        sub: t("Courbes, barres, secteurs, tableaux", "Lines, bars, pies, tables", "منحنيات، أعمدة، دوائر، جداول") },
];
