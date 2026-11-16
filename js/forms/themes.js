// Polices et thèmes (copie de Themes.kt).
import { t } from "./model.js";

export const FONTS = [
    { id: "times", label: "Times New Roman", officeName: "Times New Roman", file: null, standard: true, serif: true },
    { id: "arial", label: "Arial", officeName: "Arial", file: null, standard: true, serif: false },
    { id: "calibri", label: "Calibri", officeName: "Calibri", file: "carlito", standard: true, serif: false },
    { id: "georgia", label: "Georgia", officeName: "Georgia", file: "gelasio", standard: true, serif: true },
    { id: "poppins", label: "Poppins", officeName: "Poppins", file: "poppins", standard: false, serif: false },
    { id: "montserrat", label: "Montserrat", officeName: "Montserrat", file: "montserrat", standard: false, serif: false },
    { id: "opensans", label: "Open Sans", officeName: "Open Sans", file: "opensans", standard: false, serif: false },
    { id: "lato", label: "Lato", officeName: "Lato", file: "lato", standard: false, serif: false },
    { id: "nunito", label: "Nunito", officeName: "Nunito", file: "nunito", standard: false, serif: false },
    { id: "raleway", label: "Raleway", officeName: "Raleway", file: "raleway", standard: false, serif: false },
    { id: "robotoslab", label: "Roboto Slab", officeName: "Roboto Slab", file: "robotoslab", standard: false, serif: true },
    { id: "lora", label: "Lora", officeName: "Lora", file: "lora", standard: false, serif: true },
    { id: "merriweather", label: "Merriweather", officeName: "Merriweather", file: "merriweather", standard: false, serif: true },
    { id: "playfair", label: "Playfair Display", officeName: "Playfair Display", file: "playfair", standard: false, serif: true },
    { id: "ebgaramond", label: "EB Garamond", officeName: "EB Garamond", file: "ebgaramond", standard: false, serif: true },
];

export const font = (id) => FONTS.find((f) => f.id === id) || FONTS.find((f) => f.id === "opensans");

export const THEMES = [
    { id: "modern", name: t("Moderne", "Modern", "عصري"), hasCover: false, hasSlide: false, primary: 0xFF4F46E5, light: 0xFFF5F6FA, accent: 0xFF93C5FD, heading: "UNDERLINE", pageNum: "PIPE", bullet: "•", headFont: "poppins", bodyFont: "opensans", runningHeader: false, darkSlide: false },
    { id: "bio", name: t("Biologie aquarelle", "Watercolour biology", "أحياء مائية"), hasCover: true, hasSlide: true, primary: 0xFF2E7D32, light: 0xFFEEF4E8, accent: 0xFF9C7A3C, heading: "UNDERLINE", pageNum: "PIPE", bullet: "•", headFont: "lora", bodyFont: "lora", runningHeader: true, darkSlide: false },
    { id: "medecine", name: t("Médecine", "Medicine", "طب"), hasCover: true, hasSlide: true, primary: 0xFF1565C0, light: 0xFFE8F1FB, accent: 0xFFC62828, heading: "BAND", pageNum: "OF", bullet: "▪", headFont: "poppins", bodyFont: "opensans", runningHeader: true, darkSlide: false },
    { id: "chimie", name: t("Laboratoire", "Laboratory", "مخبر"), hasCover: true, hasSlide: true, primary: 0xFF6A1B9A, light: 0xFFF4ECF8, accent: 0xFF26A69A, heading: "LEFTBAR", pageNum: "CIRCLE", bullet: "◆", headFont: "montserrat", bodyFont: "opensans", runningHeader: false, darkSlide: false },
    { id: "ingenierie", name: t("Ingénierie", "Engineering", "هندسة"), hasCover: true, hasSlide: false, primary: 0xFF37474F, light: 0xFFEEF1F3, accent: 0xFFB87333, heading: "BADGE", pageNum: "BAND", bullet: "▸", headFont: "robotoslab", bodyFont: "opensans", runningHeader: true, darkSlide: false },
    { id: "numerique", name: t("Numérique", "Digital", "رقمي"), hasCover: true, hasSlide: true, primary: 0xFF0277BD, light: 0xFFE6F4FB, accent: 0xFF00ACC1, heading: "BOXED", pageNum: "CIRCLE", bullet: "›", headFont: "montserrat", bodyFont: "lato", runningHeader: false, darkSlide: false },
    { id: "lettres", name: t("Lettres classiques", "Classic letters", "آداب كلاسيكية"), hasCover: true, hasSlide: true, primary: 0xFF6D4C41, light: 0xFFF7F1E3, accent: 0xFFB8860B, heading: "CLASSIC", pageNum: "DASH", bullet: "–", headFont: "playfair", bodyFont: "ebgaramond", runningHeader: false, darkSlide: false },
    { id: "parchemin", name: t("Parchemin", "Parchment", "رقّ"), hasCover: true, hasSlide: true, primary: 0xFF5D4037, light: 0xFFF3E9DC, accent: 0xFF8E2430, heading: "CLASSIC", pageNum: "DASH", bullet: "•", headFont: "ebgaramond", bodyFont: "merriweather", runningHeader: false, darkSlide: false },
    { id: "corporate", name: t("Corporate", "Corporate", "مؤسسي"), hasCover: true, hasSlide: true, primary: 0xFF1A2A5E, light: 0xFFE6F6F9, accent: 0xFF13A9C2, heading: "BAND", pageNum: "BAND", bullet: "▪", headFont: "montserrat", bodyFont: "opensans", runningHeader: true, darkSlide: false },
    { id: "vertjaune", name: t("Vert et jaune", "Green and yellow", "أخضر وأصفر"), hasCover: true, hasSlide: true, primary: 0xFF1B5E20, light: 0xFFF1F8E9, accent: 0xFFF9A825, heading: "LEFTBAR", pageNum: "CIRCLE", bullet: "■", headFont: "poppins", bodyFont: "nunito", runningHeader: false, darkSlide: false },
    { id: "geometrique", name: t("Géométrique", "Geometric", "هندسي"), hasCover: true, hasSlide: true, primary: 0xFF4A148C, light: 0xFFF5EEFB, accent: 0xFFFF4F6D, heading: "BADGE", pageNum: "OF", bullet: "◆", headFont: "raleway", bodyFont: "opensans", runningHeader: false, darkSlide: false },
    { id: "cameroun", name: t("Couleurs du Cameroun", "Cameroon colours", "ألوان الكاميرون"), hasCover: true, hasSlide: true, primary: 0xFF1B7A3E, light: 0xFFFDF3F2, accent: 0xFFC62828, heading: "UNDERLINE", pageNum: "PIPE", bullet: "•", headFont: "poppins", bodyFont: "lato", runningHeader: false, darkSlide: false },
    { id: "energie", name: t("Énergie", "Energy", "طاقة"), hasCover: true, hasSlide: true, primary: 0xFF1A237E, light: 0xFFFFF3E0, accent: 0xFFF57C00, heading: "BAND", pageNum: "CIRCLE", bullet: "➤", headFont: "montserrat", bodyFont: "lato", runningHeader: true, darkSlide: false },
    { id: "vagues", name: t("Vagues bleues", "Blue waves", "أمواج زرقاء"), hasCover: true, hasSlide: true, primary: 0xFF0277BD, light: 0xFFE7F5FC, accent: 0xFF26C6DA, heading: "UNDERLINE", pageNum: "OF", bullet: "•", headFont: "nunito", bodyFont: "nunito", runningHeader: false, darkSlide: false },
    { id: "nuit", name: t("Nuit violette", "Violet night", "ليل بنفسجي"), hasCover: true, hasSlide: true, primary: 0xFF4A148C, light: 0xFFF3EDF8, accent: 0xFF00897B, heading: "LEFTBAR", pageNum: "PIPE", bullet: "◆", headFont: "raleway", bodyFont: "lato", runningHeader: false, darkSlide: true },
    { id: "lavande", name: t("Douceur lavande", "Soft lavender", "خزامى ناعمة"), hasCover: true, hasSlide: true, primary: 0xFF6A4C93, light: 0xFFF5F0FA, accent: 0xFFC9A227, heading: "UNDERLINE", pageNum: "DASH", bullet: "•", headFont: "playfair", bodyFont: "lato", runningHeader: false, darkSlide: false },
    { id: "turquoise", name: t("Ondes turquoise", "Turquoise waves", "موجات فيروزية"), hasCover: true, hasSlide: true, primary: 0xFF00796B, light: 0xFFE6F5F3, accent: 0xFF26A69A, heading: "BOXED", pageNum: "PIPE", bullet: "▸", headFont: "poppins", bodyFont: "opensans", runningHeader: false, darkSlide: false },
    { id: "nature", name: t("Pointillés nature", "Nature dots", "نقاط طبيعية"), hasCover: true, hasSlide: false, primary: 0xFF2E7D32, light: 0xFFEFF5EC, accent: 0xFF8D8D8D, heading: "BADGE", pageNum: "CIRCLE", bullet: "•", headFont: "nunito", bodyFont: "lato", runningHeader: false, darkSlide: false },
    { id: "dynamique", name: t("Dynamique", "Dynamic", "ديناميكي"), hasCover: false, hasSlide: true, primary: 0xFF424242, light: 0xFFFFF8E1, accent: 0xFFF9A825, heading: "BAND", pageNum: "BAND", bullet: "➤", headFont: "montserrat", bodyFont: "opensans", runningHeader: false, darkSlide: false },
    { id: "classic", name: t("Classique sobre", "Plain classic", "كلاسيكي بسيط"), hasCover: false, hasSlide: false, primary: 0xFF1F2937, light: 0xFFF3F4F6, accent: 0xFF6B7280, heading: "CLASSIC", pageNum: "SIMPLE", bullet: "•", headFont: "times", bodyFont: "times", runningHeader: false, darkSlide: false },
    { id: "elegant", name: t("Élégant sobre", "Plain elegant", "أنيق بسيط"), hasCover: false, hasSlide: false, primary: 0xFF0F766E, light: 0xFFEFF7F6, accent: 0xFF14B8A6, heading: "LEFTBAR", pageNum: "DASH", bullet: "•", headFont: "playfair", bodyFont: "lato", runningHeader: false, darkSlide: false },
];

export const theme = (id) => THEMES.find((x) => x.id === id) || THEMES[0];

/** Thème d'un formulaire (les anciens brouillons n'avaient qu'un « style »). */
export const themeOf = (data) => theme(data.theme || (data.style || "MODERN").toLowerCase());
