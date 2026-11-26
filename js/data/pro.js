// Crédits FAFIO (même fonctionnement que Pro.kt), plus l'achat de crédits par Mobile Money (autorisé sur le web).
// Le solde est gardé par le serveur dans un portefeuille anonyme : pas de compte, un code de sauvegarde suffit.
import { Settings } from "./storage.js";

/** Mode test : bouton « crédits de test » dans les paramètres. */
export const TEST_MODE = true;
/** Adresse du serveur FAFIO (Cloudflare Workers). Vide = pas encore en ligne. */
export const API_URL = "https://fafio-api.infosaxolut.workers.dev";
/** Packs (affichés seulement au moment d'acheter) : 1 crédit = 25 F, bonus sur les gros packs. Mêmes valeurs que le serveur. */
export const PACKS = [
    { id: "p4", price: 100, credits: 4 },
    { id: "p11", price: 250, credits: 11 },
    { id: "p24", price: 500, credits: 24 },
    { id: "p50", price: 1000, credits: 50 },
    { id: "p130", price: 2500, credits: 130 },
];
export const FILL_COST = { info: 1, idea: 2 };
export const UNLOCK_DAYS = 7;

export const online = () => !!API_URL;

/**
 * Coût d'un document en crédits (même grille dans Pro.kt) :
 * mémoire 10 / 15 / 20 crédits (40, 80 pages) ; rapports, exposés écrits, comptes rendus 1 à 4 crédits (5, 15, 30 pages) ;
 * présentations 1 à 3 crédits (10, 20 diapositives) ; tous les autres documents 1 crédit.
 */
export function costOf(type, pages, slides) {
    const n = Math.max(1, pages || 1);
    if (type.id === "memoire") return n <= 40 ? 10 : n <= 80 ? 15 : 20;
    if (slides) return n <= 10 ? 1 : n <= 20 ? 2 : 3;
    if (type.module === "REPORTS") return n <= 5 ? 1 : n <= 15 ? 2 : n <= 30 ? 3 : 4;
    return 1;
}

/** Formats payants : Word, PowerPoint, et le PDF sans la mention « Fait avec FAFIO ». Le PDF avec mention et l'image sont gratuits. */
export const isPaid = (format, clean) => format === "DOCX" || format === "PPTX" || (format === "PDF" && clean);

// ---- Portefeuille (sans compte) : la clé secrète de l'appareil est aussi son code de sauvegarde
const KEY_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function deviceId() {
    let id = Settings.get("pro.wallet", "");
    if (!id) {
        const b = crypto.getRandomValues(new Uint8Array(16));
        const s = [...b].map((x) => KEY_CHARS[x % KEY_CHARS.length]).join("");
        id = `FAF-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
        Settings.set("pro.wallet", id);
    }
    return id;
}
export const backupCode = () => deviceId();

/** Dernier état connu du portefeuille (affiché même hors ligne). */
export function state() {
    try { return JSON.parse(Settings.get("pro.state", "")) || {}; } catch (e) { return {}; }
}
export const credits = () => state().credits || 0;
function keep(r) {
    if (r && typeof r.credits === "number") Settings.set("pro.state", JSON.stringify({ credits: r.credits, ref: r.ref, adsLeft: r.adsLeft, canRefer: r.canRefer, referred: r.referred }));
    return r;
}

/** Crée ou relit le portefeuille ; les anciens crédits locaux y sont versés une fois. */
export async function refresh() {
    if (!online()) return state();
    const migrate = Settings.get("pro.migrated", "") ? 0 : parseInt(Settings.get("pro.credits", "0"), 10) || 0;
    const r = keep(await call("/api/wallet", { device: deviceId(), migrate }));
    if (!Settings.get("pro.migrated", "")) { Settings.set("pro.migrated", "1"); Settings.set("pro.credits", "0"); }
    return r;
}

const paidKey = (docId) => "pro.paid." + docId;
/** Coût déjà payé pour ce document (re-téléchargements gratuits pendant 7 jours). */
export function paidFor(docId) {
    try { const p = JSON.parse(Settings.get(paidKey(docId), "")); return p && p.until > Date.now() ? p.cost : 0; } catch (e) { return 0; }
}

/** Paie un document (cost = 0 : téléchargement gratuit, sert au parrainage). Renvoie { ok, need, credits }. */
export async function spend(docId, cost) {
    try {
        const r = keep(await call("/api/spend", { device: deviceId(), doc: docId, cost }));
        if (cost > 0) Settings.set(paidKey(docId), JSON.stringify({ cost: Math.max(cost, paidFor(docId)), until: Date.now() + UNLOCK_DAYS * 86400000 }));
        return { ok: true, charged: r.charged, credits: r.credits };
    } catch (e) {
        if (e.data && e.data.need) { keep(e.data); return { ok: false, need: e.data.need, credits: e.data.credits }; }
        throw e;
    }
}

export async function referral(code) { return keep(await call("/api/referral", { device: deviceId(), code })); }
export async function testCredits() { return keep(await call("/api/test/credits", { device: deviceId() })); }

/** Restaure un portefeuille sauvegardé : il devient celui de cet appareil (le solde actuel s'y ajoute). */
export async function restore(code) {
    const r = await call("/api/restore", { device: deviceId(), code: String(code).trim().toUpperCase() });
    Settings.set("pro.wallet", r.key);
    return keep(r);
}

async function call(path, body) {
    const r = await fetch(API_URL.replace(/\/$/, "") + path, body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || "HTTP " + r.status); e.data = data; e.status = r.status; throw e; }
    return data;
}

/** Code de recharge : renvoie le nombre de crédits ajoutés. */
export async function redeem(code) {
    const r = keep(await call("/api/redeem", { code: String(code).trim().toUpperCase(), device: deviceId() }));
    return r.added || 0;
}

/** Assistant de rédaction : task = improve, fix, expand, summarize, translate. */
export async function ai(task, text, lang) {
    const r = await call("/api/ai", { task, text, lang, device: deviceId() });
    return String(r.text || "").trim();
}

/** Remplissage automatique : schema = champs du formulaire, files = [{ name, data (data URL) }],
 * opts = { mode: "idea", rule, level, length, wiki } pour rédiger à partir d'une idée. Renvoie { values, groups, sources, left }. */
export async function fill(schema, text, files, lang, opts = {}) {
    return keep(await call("/api/fill", { schema, text, files, lang, device: deviceId(), ...opts }));
}

/** Achat d'un pack : ouvre la page de paiement Mobile Money, la vérification se fait au retour. */
export async function buy(packId) {
    const r = await call("/api/pay/init", { pack: packId, device: deviceId(), redirect: location.href.split("#")[0] + "#/settings" });
    Settings.set("pro.pendingTx", r.tx);
    location.href = r.link;
}

/** Au retour du paiement : vérifie, récupère le code et ajoute les crédits. Renvoie { credits, code } ou null. */
export async function checkPending() {
    const tx = Settings.get("pro.pendingTx", "");
    if (!tx || !online()) return null;
    for (let i = 0; i < 6; i++) {
        let st;
        try { st = await call("/api/pay/status?tx=" + encodeURIComponent(tx)); } catch (e) { return null; }
        if (st.code) {
            Settings.set("pro.pendingTx", "");
            const n = await redeem(st.code).catch(() => 0);
            return { credits: n, code: st.code };
        }
        if (st.status === "FAILED" || st.status === "EXPIRED") { Settings.set("pro.pendingTx", ""); return { failed: true }; }
        await new Promise((res) => setTimeout(res, 4000));
    }
    return null;
}
