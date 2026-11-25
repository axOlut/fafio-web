// Gratuit / Pro (mode test) : copie de Pro.kt, plus l'achat de crédits par Mobile Money (autorisé sur le web).
import { Settings } from "./storage.js";

/** Mode test : bouton « crédits de test » dans les paramètres. */
export const TEST_MODE = true;
/** Adresse du serveur FAFIO (Cloudflare Workers). Vide = pas encore en ligne. */
export const API_URL = "https://fafio-api.infosaxolut.workers.dev";
export const UNLOCK_DAYS = 30;
export const PACKS = [
    { id: "p3", price: 200, credits: 3 },
    { id: "p10", price: 500, credits: 10 },
    { id: "p35", price: 1500, credits: 35 },
];

export const isPro = (type, format) => format === "DOCX" || format === "PPTX" || type.id === "memoire";
export const online = () => !!API_URL;

export const credits = () => parseInt(Settings.get("pro.credits", "0"), 10) || 0;
export function addCredits(n) { Settings.set("pro.credits", String(Math.max(0, credits() + n))); }

export const isUnlocked = (draftId) => (parseInt(Settings.get("pro.unlock." + draftId, "0"), 10) || 0) > Date.now();

export function unlock(draftId) {
    if (isUnlocked(draftId)) return true;
    if (credits() <= 0) return false;
    Settings.set("pro.credits", String(credits() - 1));
    Settings.set("pro.unlock." + draftId, String(Date.now() + UNLOCK_DAYS * 86400000));
    return true;
}

export function deviceId() {
    let id = Settings.get("pro.device", "");
    if (!id) {
        const r = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
        id = "FW-" + r.slice(0, 4) + "-" + r.slice(4, 8);
        Settings.set("pro.device", id);
    }
    return id;
}

async function call(path, body) {
    const r = await fetch(API_URL.replace(/\/$/, "") + path, body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
    return data;
}

/** Code de recharge : renvoie le nombre de crédits ajoutés. */
export async function redeem(code) {
    const r = await call("/api/redeem", { code: String(code).trim().toUpperCase(), device: deviceId() });
    if (r.credits > 0) addCredits(r.credits);
    return r.credits || 0;
}

/** Assistant de rédaction : task = improve, fix, expand, summarize, translate. */
export async function ai(task, text, lang) {
    const r = await call("/api/ai", { task, text, lang, device: deviceId() });
    return String(r.text || "").trim();
}

/** Remplissage automatique : schema = champs du formulaire, files = [{ name, data (data URL) }],
 * opts = { mode: "idea", rule, level, length, wiki } pour rédiger à partir d'une idée. Renvoie { values, groups, sources, left }. */
export async function fill(schema, text, files, lang, opts = {}) {
    return call("/api/fill", { schema, text, files, lang, device: deviceId(), ...opts });
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
