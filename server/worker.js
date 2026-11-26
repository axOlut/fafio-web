// Serveur FAFIO (Cloudflare Workers, offre gratuite) : portefeuilles de crédits (sans compte), parrainage, codes de recharge,
// paiement Mobile Money (Fapshi), assistant IA.
// IA : Workers AI de Cloudflare (liaison « AI », sans clé) ou, si un secret GEMINI_KEY est ajouté, Gemini.
// Aucun secret dans ce fichier : les clés sont des « secrets » du Worker (GEMINI_KEY, FAPSHI_USER, FAPSHI_KEY, ADMIN_TOKEN).
// Stockage : un espace KV lié sous le nom FAFIO.

// 1 crédit = 25 F ; bonus sur les gros packs. Les montants en francs n'apparaissent qu'au moment de l'achat.
const PACKS = {
    p4: { price: 100, credits: 4 },
    p11: { price: 250, credits: 11 },
    p24: { price: 500, credits: 24 },
    p50: { price: 1000, credits: 50 },
    p130: { price: 2500, credits: 130 },
};
const WELCOME = 5;          // crédits offerts à la création du portefeuille
const AD_REWARD = 2;        // crédits par vidéo publicitaire regardée
const ADS_PER_DAY = 2;      // vidéos récompensées par jour
const REF_NEW = 3;          // bonus du filleul
const REF_SPONSOR = 5;      // bonus du parrain, quand le filleul crée son premier document
const REF_PER_MONTH = 30;   // parrainages récompensés par parrain et par mois
const UNLOCK_DAYS = 7;      // un document payé se retélécharge gratuitement pendant 7 jours
const FILL_COST = { info: 1, idea: 2 };
const AI_PER_DAY = 10; // demandes d'IA gratuites par appareil et par jour
const MAX_TEXT = 6000;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O, 1/I/L

const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
});
const fail = (error, status = 400) => json({ error }, status);
const today = () => new Date().toISOString().slice(0, 10).replaceAll("-", "");

function newCode() {
    const b = crypto.getRandomValues(new Uint8Array(8));
    const s = [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
    return `FAF-${s.slice(0, 4)}-${s.slice(4)}`;
}

async function createCode(env, credits, origin) {
    for (let i = 0; i < 5; i++) {
        const code = newCode();
        if (await env.FAFIO.get("code:" + code)) continue;
        await env.FAFIO.put("code:" + code, JSON.stringify({ credits, used: false, origin, created: Date.now() }));
        return code;
    }
    throw new Error("code");
}

// ---------------------------------------------------------------- Portefeuilles (sans compte)
// Chaque appareil crée une clé secrète FAF-XXXX-XXXX-XXXX-XXXX (80 bits) : c'est aussi son code de sauvegarde.
// La saisir sur un autre appareil (ou sur le web) y ramène le solde. Aucun nom, aucun numéro.

const WALLET_RE = /^FAF(-[A-Z0-9]{4}){4}$/;
const month = () => today().slice(0, 6);

function walletKey(body) {
    const k = String(body.device || "").trim().toUpperCase();
    return WALLET_RE.test(k) ? k : null;
}

async function loadWallet(env, key) {
    const raw = await env.FAFIO.get("w:" + key);
    return raw ? JSON.parse(raw) : null;
}
const saveWallet = (env, key, w) => env.FAFIO.put("w:" + key, JSON.stringify(w));

function refCode() {
    const b = crypto.getRandomValues(new Uint8Array(6));
    return [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
}

/** Portefeuille de l'appareil ; créé au premier appel avec les crédits de bienvenue (+ les anciens crédits locaux, plafonnés). */
async function getWallet(env, key, migrate = 0) {
    let w = await loadWallet(env, key);
    if (w) return w;
    let ref = refCode();
    for (let i = 0; i < 4 && (await env.FAFIO.get("ref:" + ref)); i++) ref = refCode();
    w = { credits: WELCOME + Math.max(0, Math.min(50, parseInt(migrate, 10) || 0)), created: Date.now(), ref, by: null, first: false, ads: { day: "", n: 0 } };
    await env.FAFIO.put("ref:" + ref, key);
    await saveWallet(env, key, w);
    return w;
}

const view = (w) => ({
    credits: w.credits,
    ref: w.ref,
    adsLeft: w.ads && w.ads.day === today() ? Math.max(0, ADS_PER_DAY - w.ads.n) : ADS_PER_DAY,
    canRefer: !w.by && !w.first,
    referred: !!w.by,
});

async function wallet(env, body) {
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    return json(view(await getWallet(env, key, body.migrate)));
}

/** Premier document du filleul : le parrain reçoit son bonus (plafonné par mois). */
async function firstDocument(env, w) {
    if (w.first) return;
    w.first = true;
    if (!w.by) return;
    const sponsor = await loadWallet(env, w.by);
    if (!sponsor) return;
    const m = month();
    sponsor.refs = sponsor.refs && sponsor.refs.m === m ? sponsor.refs : { m, n: 0 };
    if (sponsor.refs.n >= REF_PER_MONTH) return;
    sponsor.refs.n++;
    sponsor.credits += REF_SPONSOR;
    await saveWallet(env, w.by, sponsor);
}

/**
 * Téléchargement d'un document : cost = crédits demandés (0 pour un PDF gratuit avec la mention FAFIO).
 * Un document payé se retélécharge gratuitement pendant UNLOCK_DAYS ; s'il grossit, seule la différence est demandée.
 */
async function spend(env, body) {
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    const doc = String(body.doc || "").slice(0, 60);
    const cost = Math.max(0, Math.min(20, parseInt(body.cost, 10) || 0));
    const w = await getWallet(env, key);
    let charged = 0;
    if (cost > 0 && doc) {
        const uk = `u:${key}:${doc}`;
        const raw = await env.FAFIO.get(uk);
        const u = raw ? JSON.parse(raw) : null;
        const paid = u && u.until > Date.now() ? u.paid : 0;
        const need = Math.max(0, cost - paid);
        if (need > w.credits) return json({ error: "crédits insuffisants", need, ...view(w) }, 402);
        if (need > 0) {
            w.credits -= need; charged = need;
            await env.FAFIO.put(uk, JSON.stringify({ paid: cost, until: Date.now() + UNLOCK_DAYS * 86400000 }), { expirationTtl: UNLOCK_DAYS * 86400 + 3600 });
        }
    }
    await firstDocument(env, w);
    await saveWallet(env, key, w);
    return json({ charged, ...view(w) });
}

/** Vidéo publicitaire regardée jusqu'au bout (application Android). */
async function reward(env, body) {
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    const w = await getWallet(env, key);
    const d = today();
    if (!w.ads || w.ads.day !== d) w.ads = { day: d, n: 0 };
    if (w.ads.n >= ADS_PER_DAY) return json({ error: `limite de ${ADS_PER_DAY} vidéos par jour atteinte`, ...view(w) }, 429);
    w.ads.n++;
    w.credits += AD_REWARD;
    await saveWallet(env, key, w);
    return json({ added: AD_REWARD, ...view(w) });
}

/** Code de parrainage d'un ami : seulement avant le premier document, une seule fois. */
async function referral(env, body) {
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const w = await getWallet(env, key);
    if (w.by) return fail("un code de parrainage a déjà été utilisé sur cet appareil", 409);
    if (w.first) return fail("le code de parrainage se saisit avant le premier document", 409);
    const sponsor = await env.FAFIO.get("ref:" + code);
    if (!sponsor) return fail("code de parrainage inconnu", 404);
    if (sponsor === key) return fail("tu ne peux pas utiliser ton propre code", 409);
    w.by = sponsor;
    w.credits += REF_NEW;
    await saveWallet(env, key, w);
    return json({ added: REF_NEW, ...view(w) });
}

/** Restauration : le solde de l'appareil actuel rejoint le portefeuille sauvegardé, qui devient celui de l'appareil. */
async function restore(env, body) {
    const target = String(body.code || "").trim().toUpperCase();
    if (!WALLET_RE.test(target)) return fail("code de sauvegarde invalide");
    const t = await loadWallet(env, target);
    if (!t) return fail("code de sauvegarde inconnu", 404);
    const key = walletKey(body);
    if (key && key !== target) {
        const cur = await loadWallet(env, key);
        if (cur && cur.credits > 0) {
            t.credits += cur.credits;
            cur.credits = 0;
            await saveWallet(env, key, cur);
        }
    }
    await saveWallet(env, target, t);
    return json({ key: target, ...view(t) });
}

/** Mode test (variable TEST_CREDITS = 1 dans Cloudflare) : +5 crédits, 3 fois par jour au plus. */
async function testCredits(env, body) {
    if (env.TEST_CREDITS !== "1") return fail("mode test désactivé", 403);
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    const w = await getWallet(env, key);
    const d = today();
    w.test = w.test && w.test.day === d ? w.test : { day: d, n: 0 };
    if (w.test.n >= 3) return fail("limite du mode test atteinte pour aujourd'hui", 429);
    w.test.n++;
    w.credits += 5;
    await saveWallet(env, key, w);
    return json({ added: 5, ...view(w) });
}

// ---------------------------------------------------------------- Codes de recharge

async function redeem(env, body) {
    const code = String(body.code || "").trim().toUpperCase();
    const device = String(body.device || "").slice(0, 40);
    if (!/^FAF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return fail(WALLET_RE.test(code) ? "c'est un code de sauvegarde : utilise « Restaurer mes crédits »" : "code invalide");
    const raw = await env.FAFIO.get("code:" + code);
    if (!raw) return fail("code inconnu", 404);
    const c = JSON.parse(raw);
    if (c.used) return fail("code déjà utilisé", 409);
    c.used = true; c.device = device; c.usedAt = Date.now();
    await env.FAFIO.put("code:" + code, JSON.stringify(c));
    const key = walletKey(body);
    if (key) {
        const w = await getWallet(env, key);
        w.credits += c.credits;
        await saveWallet(env, key, w);
        return json({ added: c.credits, ...view(w) });
    }
    return json({ added: c.credits, credits: c.credits });
}

/** Codes créés à la main (vente par WhatsApp avant la passerelle) : Authorization: Bearer ADMIN_TOKEN. */
async function adminCodes(env, req, body) {
    const auth = req.headers.get("Authorization") || "";
    if (!env.ADMIN_TOKEN || auth !== "Bearer " + env.ADMIN_TOKEN) return fail("non autorisé", 401);
    const credits = Math.max(1, Math.min(500, parseInt(body.credits, 10) || 0));
    const count = Math.max(1, Math.min(50, parseInt(body.count, 10) || 1));
    const codes = [];
    for (let i = 0; i < count; i++) codes.push(await createCode(env, credits, "admin"));
    return json({ codes, credits });
}

// ---------------------------------------------------------------- Paiement Mobile Money (Fapshi)

const fapshiBase = (env) => (env.FAPSHI_SANDBOX === "1" ? "https://sandbox.fapshi.com" : "https://live.fapshi.com");

async function fapshi(env, path, init = {}) {
    const r = await fetch(fapshiBase(env) + path, {
        ...init,
        headers: { "Content-Type": "application/json", apiuser: env.FAPSHI_USER || "", apikey: env.FAPSHI_KEY || "", ...(init.headers || {}) },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "Fapshi " + r.status);
    return data;
}

async function payInit(env, body) {
    const pack = PACKS[body.pack];
    if (!pack) return fail("offre inconnue");
    if (!env.FAPSHI_USER || !env.FAPSHI_KEY) return fail("paiement pas encore activé", 503);
    const externalId = "fafio-" + Date.now().toString(36);
    const data = await fapshi(env, "/initiate-pay", {
        method: "POST",
        body: JSON.stringify({ amount: pack.price, externalId, message: `FAFIO : ${pack.credits} crédits`, redirectUrl: String(body.redirect || "") }),
    });
    await env.FAFIO.put("tx:" + data.transId, JSON.stringify({ pack: body.pack, credits: pack.credits, status: "PENDING", created: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
    return json({ link: data.link, tx: data.transId });
}

/** Vérifie le paiement auprès de Fapshi (on ne croit jamais le corps du message reçu) et crée le code une seule fois. */
async function settle(env, transId) {
    const raw = await env.FAFIO.get("tx:" + transId);
    if (!raw) return null;
    const tx = JSON.parse(raw);
    if (tx.code || tx.status === "FAILED" || tx.status === "EXPIRED") return tx;
    const st = await fapshi(env, "/payment-status/" + encodeURIComponent(transId));
    tx.status = st.status;
    if (st.status === "SUCCESSFUL" && !tx.code && Number(st.amount) >= PACKS[tx.pack].price) tx.code = await createCode(env, tx.credits, "fapshi:" + transId);
    await env.FAFIO.put("tx:" + transId, JSON.stringify(tx), { expirationTtl: 60 * 60 * 24 * 30 });
    return tx;
}

async function payWebhook(env, body) {
    if (body && body.transId) await settle(env, String(body.transId));
    return json({ ok: true });
}

async function payStatus(env, url) {
    const transId = url.searchParams.get("tx") || "";
    const tx = await settle(env, transId);
    if (!tx) return fail("paiement inconnu", 404);
    return json({ status: tx.status, code: tx.code || null, credits: tx.credits });
}

// ---------------------------------------------------------------- Assistant de rédaction (Workers AI ou Gemini)

const RULES = "Réponds uniquement avec le texte demandé, sans introduction ni commentaire. Garde la langue du texte (sauf traduction). "
    + "Garde intactes les formules entre $…$ ou $$…$$, les lignes qui commencent par # (titres) ou - (puces) et les repères [[…]]. "
    + "N'invente ni chiffre, ni source, ni citation.";
const TASKS = {
    improve: "Améliore le style de ce texte académique : phrases claires, vocabulaire précis, ton soutenu. Garde le sens et la longueur approximative.",
    fix: "Corrige l'orthographe, la grammaire, la conjugaison et la ponctuation de ce texte. Ne change rien d'autre.",
    expand: "À partir de ces notes, rédige des paragraphes clairs et bien construits pour un document académique (rapport, mémoire).",
    summarize: "Résume ce texte en un paragraphe court qui garde les idées principales.",
    translate: "Traduis ce texte en anglais académique (par exemple pour un abstract).",
};

/** Quota partagé par toutes les demandes d'IA : AI_PER_DAY par appareil et par jour. Renvoie le nombre déjà utilisé, ou null si dépassé. */
async function takeQuota(env, body, req) {
    const who = String(body.device || req.headers.get("CF-Connecting-IP") || "anon").slice(0, 40);
    const key = `ai:${who}:${today()}`;
    const used = parseInt((await env.FAFIO.get(key)) || "0", 10);
    if (used >= AI_PER_DAY) return null;
    await env.FAFIO.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
    return used;
}

async function ai(env, body, req) {
    const task = TASKS[body.task];
    const text = String(body.text || "").slice(0, MAX_TEXT).trim();
    if (!task) return fail("tâche inconnue");
    if (!text) return fail("texte vide");
    if (!env.GEMINI_KEY && !env.AI) return fail("assistant pas encore activé", 503);
    const used = await takeQuota(env, body, req);
    if (used === null) return fail(`limite de ${AI_PER_DAY} demandes par jour atteinte, reviens demain`, 429);
    const system = task + " " + RULES;
    if (!env.GEMINI_KEY) {
        // IA intégrée de Cloudflare : incluse dans l'offre gratuite (10 000 « neurones » par jour), aucune clé à gérer
        const res = await env.AI.run(env.AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct", {
            messages: [{ role: "system", content: system }, { role: "user", content: text }],
            max_tokens: 2048, temperature: 0.4,
        });
        const out = String((res && res.response) || "").trim();
        if (!out) return fail("aucune réponse", 502);
        return json({ text: out, left: AI_PER_DAY - used - 1 });
    }
    const out = await gemini(env, system, [{ text }], false);
    if (!out) return fail("aucune réponse", 502);
    return json({ text: out, left: AI_PER_DAY - used - 1 });
}

async function gemini(env, system, parts, asJson) {
    const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { temperature: asJson ? 0.1 : 0.4, maxOutputTokens: 4096, ...(asJson ? { responseMimeType: "application/json" } : {}) },
        }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data.error && data.error.message) || "IA indisponible");
    return ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
}

// ---------------------------------------------------------------- Remplissage automatique d'un formulaire

const FILL_FILES = 4;
const LANG_NAME = { fr: "français", en: "anglais", ar: "arabe" };

function bytesOf(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Extrait l'objet JSON d'une réponse de modèle (avec ou sans ``` autour). */
function parseJsonReply(out) {
    if (out && typeof out === "object") return out;
    const txt = String(out || "");
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(txt.slice(a, b + 1)); } catch (e) { return null; }
}

/** Ne garde que les champs du formulaire, en texte. */
function cleanFill(raw, schema) {
    const str = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter((x) => x).join("\n") : v == null ? "" : typeof v === "object" ? "" : String(v).trim());
    const values = {}, groups = {};
    const fieldIds = new Set((schema.fields || []).map((f) => f.id));
    for (const [k, v] of Object.entries((raw && raw.values) || {})) if (fieldIds.has(k) && str(v)) values[k] = str(v);
    for (const g of schema.groups || []) {
        const ids = new Set((g.fields || []).map((f) => f.id));
        const list = ((raw && raw.groups) || {})[g.id];
        if (!Array.isArray(list)) continue;
        const items = [];
        for (const it of list.slice(0, 30)) {
            if (!it || typeof it !== "object") continue;
            const o = {};
            for (const [k, v] of Object.entries(it)) if (ids.has(k) && str(v)) o[k] = str(v);
            if (Object.keys(o).length) items.push(o);
        }
        if (items.length) groups[g.id] = items;
    }
    return { values, groups };
}

async function fill(env, body, req) {
    const schema = body.schema;
    if (!schema || !Array.isArray(schema.fields)) return fail("formulaire inconnu");
    const text = String(body.text || "").slice(0, 12000).trim();
    const files = (Array.isArray(body.files) ? body.files : []).slice(0, FILL_FILES);
    if (!text && !files.length) return fail("rien à lire : écris quelques lignes ou ajoute un fichier");
    if (!env.GEMINI_KEY && !env.AI) return fail("assistant pas encore activé", 503);
    const key = walletKey(body);
    if (!key) return fail("portefeuille invalide");
    const fillCost = body.mode === "idea" ? FILL_COST.idea : FILL_COST.info;
    let w = await getWallet(env, key);
    if (w.credits < fillCost) return json({ error: "crédits insuffisants", need: fillCost, ...view(w) }, 402);
    const used = await takeQuota(env, body, req);
    if (used === null) return fail(`limite de ${AI_PER_DAY} demandes par jour atteinte, reviens demain`, 429);
    try {
        const out = await fillRun(env, body, schema, text, files);
        if (out instanceof Response) return out;
        w = await getWallet(env, key);
        w.credits -= fillCost;
        await saveWallet(env, key, w);
        return json({ ...out, charged: fillCost, left: AI_PER_DAY - used - 1, ...view(w) });
    } catch (e) {
        return fail(String(e.message || e), 502);
    }
}

/** Le travail de l'IA : renvoie { values, groups, sources } ou une réponse d'erreur. Aucun crédit n'est pris en cas d'échec. */
async function fillRun(env, body, schema, text, files) {
    // Fichiers : images à part, documents (PDF, Word) convertis en texte
    const images = [], docs = [];
    for (const f of files) {
        const m = /^data:([^;,]+);base64,(.+)$/.exec(String(f.data || ""));
        if (!m) continue;
        const name = String(f.name || "document").slice(0, 80);
        if (m[1].startsWith("image/")) images.push({ mime: m[1], b64: m[2], url: f.data });
        else docs.push({ name, mime: m[1], b64: m[2] });
    }

    const lang = LANG_NAME[body.lang] || "français";
    const idea = body.mode === "idea";
    const rule = body.rule === "full" ? "full" : "facts";
    const todo = TODO[body.lang] || TODO.fr;
    const common = "Réponds UNIQUEMENT avec un objet JSON de la forme {\"values\":{},\"groups\":{}}, sans aucun texte autour. "
        + "« values » : pour chaque champ simple que tu remplis, son identifiant « id » et sa valeur en texte. "
        + "« groups » : pour chaque groupe, une liste d'éléments ; chaque élément est un objet {identifiant_du_champ: valeur}. "
        + "Champs de type LIST : une valeur par ligne, séparées par \\n, sans tiret ni puce. "
        + "Champs de type CHOICE : le numéro de l'option choisie (0, 1, 2…). "
        + `Écris en ${lang}, sans faute d'orthographe. `;
    let system;
    let sources = [];
    let wikiText = "";
    if (!idea) {
        system = "Tu remplis automatiquement un formulaire de document à partir des informations fournies (texte, photo ou document). " + common
            + "N'invente rien : n'utilise que ce qui figure dans la source et omets les champs inconnus. "
            + "Corrige l'orthographe et la grammaire sans changer le sens. Garde l'ordre de la source. ";
    } else {
        const level = LEVELS[body.level] || LEVELS.lycee;
        const size = SIZES[body.length] || SIZES.moyen;
        system = "Tu es un rédacteur expert. À partir de l'idée donnée, tu rédiges le contenu complet d'un document en remplissant les champs du formulaire. " + common
            + `Public : ${level}. Longueur : ${size}. `
            + "Rédige un contenu exact, structuré et clair : un titre précis, une introduction, des parties qui se suivent logiquement, une conclusion. "
            + "Dans les champs de texte long, sépare les paragraphes par une ligne vide ; tu peux faire des listes avec « - » en début de ligne. "
            + "Pour une présentation, chaque diapositive a un titre court et 3 à 5 points brefs. "
            + "N'invente jamais de citation, de statistique précise, de date ou de source : si une donnée précise est indispensable et que tu n'en es pas sûr, écris "
            + `« ${todo} » à sa place. Ne rédige pas de bibliographie toi-même : laisse vides les champs de références ou de sources. `
            + "Laisse vides les champs d'identité et d'administration : noms de personnes, établissement, entreprise, enseignant, encadreur, date, lieu, contacts, numéros, signataire. ";
        if (rule === "facts") system += "Ce document décrit des faits réels que tu ne connais pas (lieu, personnes, résultats, chiffres, dates, missions réelles) : "
            + `rédige le texte, mais à chaque endroit où un fait réel est nécessaire, écris « ${todo} » au lieu de l'inventer. `;
        if (body.wiki) {
            try {
                const w = await wikipedia(env, text, body.lang);
                sources = w.sources; wikiText = w.text;
            } catch (e) { /* Wikipédia indisponible : on rédige sans */ }
            if (wikiText) system += "Appuie-toi en priorité sur les extraits de Wikipédia fournis pour les faits. ";
        }
    }
    system += "Formulaire (identifiants, libellés et types) : " + JSON.stringify(schema);
    const intro = idea ? "Idée du document :\n" + (text || "(voir les fichiers joints)") : (text ? "Informations fournies :\n" + text : "Lis les fichiers joints.");

    let reply;
    if (env.GEMINI_KEY) {
        // Gemini lit directement les images et les PDF
        const parts = [{ text: intro + (wikiText ? "\n\nExtraits de Wikipédia :\n" + wikiText : "") }];
        for (const im of images) parts.push({ inline_data: { mime_type: im.mime, data: im.b64 } });
        for (const d of docs) parts.push({ inline_data: { mime_type: d.mime, data: d.b64 } });
        reply = await gemini(env, system, parts, true);
    } else {
        let extra = "";
        if (docs.length) {
            if (!env.AI.toMarkdown) return fail("lecture des documents indisponible", 503);
            const res = await env.AI.toMarkdown(docs.map((d) => ({ name: d.name, blob: new Blob([bytesOf(d.b64)], { type: d.mime }) })));
            for (const r of [].concat(res || [])) {
                if (r && r.data) extra += `\n\n--- ${r.name} ---\n` + String(r.data).slice(0, 15000);
                else if (r && r.error) return fail(`fichier illisible (${r.name}) : ${r.error}`, 422);
            }
        }
        if (wikiText) extra += "\n\nExtraits de Wikipédia :\n" + wikiText;
        const userText = intro + extra;
        const model = images.length ? (env.AI_VISION_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct") : (env.AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct");
        const content = images.length ? [{ type: "text", text: userText }, ...images.map((im) => ({ type: "image_url", image_url: { url: im.url } }))] : userText;
        const input = { messages: [{ role: "system", content: system }, { role: "user", content }], max_tokens: idea ? 7000 : 3500, temperature: idea ? 0.5 : 0.1 };
        let res;
        try { res = await env.AI.run(model, { ...input, response_format: { type: "json_object" } }); }
        catch (e) { res = await env.AI.run(model, input); }
        reply = res && res.response;
    }
    const parsed = parseJsonReply(reply);
    if (!parsed) return fail("réponse de l'IA illisible, réessaie", 502);
    return { ...cleanFill(parsed, schema), sources };
}

// ---------------------------------------------------------------- Rédaction à partir d'une idée

const TODO = { fr: "[à compléter]", en: "[to be completed]", ar: "[يُستكمل]" };
const LEVELS = {
    college: "élèves de collège (vocabulaire simple, explications concrètes)",
    lycee: "élèves de lycée (vocabulaire courant, notions expliquées)",
    universite: "étudiants à l'université (vocabulaire précis, analyse approfondie)",
    pro: "professionnels (ton soutenu, concret, orienté résultats)",
};
const SIZES = {
    court: "court (2 parties d'un ou deux paragraphes, ou 6 diapositives environ)",
    moyen: "moyen (3 parties de deux ou trois paragraphes, ou 10 diapositives environ)",
    long: "détaillé (4 ou 5 parties de trois paragraphes ou plus, avec sous-parties, ou 14 diapositives environ)",
};
const WIKI_UA = "FAFIO/1.0 (https://axolut.github.io/fafio-web/)";

/** Lit 1 ou 2 articles Wikipédia liés à l'idée (gratuit, sans clé). Renvoie { text, sources: [{ title, url }] }. */
async function wikipedia(env, idea, lang) {
    const wl = ["fr", "en", "ar"].includes(lang) ? lang : "fr";
    // 1. sujets à chercher (l'IA les extrait de l'idée ; sinon l'idée elle-même)
    let topics = [];
    if (env.AI) {
        try {
            const r = await env.AI.run(env.AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct", {
                messages: [
                    { role: "system", content: `Donne 1 ou 2 titres d'articles Wikipédia (en ${LANG_NAME[wl]}) qui couvrent le sujet de cette idée. Réponds uniquement par un tableau JSON de chaînes, par exemple ["Photosynthèse"].` },
                    { role: "user", content: String(idea).slice(0, 600) },
                ],
                max_tokens: 60, temperature: 0,
            });
            const m = /\[[\s\S]*\]/.exec(String((r && r.response) || ""));
            if (m) topics = JSON.parse(m[0]).filter((x) => typeof x === "string" && x.trim()).slice(0, 2);
        } catch (e) { topics = []; }
    }
    if (!topics.length) topics = [String(idea).slice(0, 120)];
    // 2. recherche puis texte des articles
    const seen = new Set(), sources = [];
    let text = "";
    for (const q of topics) {
        const sr = await fetch(`https://${wl}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=1`, { headers: { "User-Agent": WIKI_UA } });
        const sj = await sr.json().catch(() => ({}));
        const page = (sj.pages || [])[0];
        if (!page || seen.has(page.key)) continue;
        seen.add(page.key);
        const er = await fetch(`https://${wl}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(page.title)}`, { headers: { "User-Agent": WIKI_UA } });
        const ej = await er.json().catch(() => ({}));
        const pg = Object.values((ej.query && ej.query.pages) || {})[0];
        const extract = String((pg && pg.extract) || "").replace(/\n{3,}/g, "\n\n").slice(0, 9000);
        if (!extract) continue;
        text += `\n\n=== ${page.title} ===\n` + extract;
        sources.push({ title: page.title, url: `https://${wl}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` });
    }
    return { text: text.trim(), sources };
}

// ---------------------------------------------------------------- Routage

export default {
    async fetch(req, env) {
        const url = new URL(req.url);
        if (req.method === "OPTIONS") return json({});
        try {
            if (url.pathname === "/api/health") return json({ ok: true, ai: !!(env.GEMINI_KEY || env.AI), pay: !!(env.FAPSHI_USER && env.FAPSHI_KEY), test: env.TEST_CREDITS === "1", packs: PACKS });
            if (url.pathname === "/api/pay/status" && req.method === "GET") return await payStatus(env, url);
            if (req.method !== "POST") return fail("introuvable", 404);
            const body = await req.json().catch(() => ({}));
            switch (url.pathname) {
                case "/api/wallet": return await wallet(env, body);
                case "/api/spend": return await spend(env, body);
                case "/api/reward": return await reward(env, body);
                case "/api/referral": return await referral(env, body);
                case "/api/restore": return await restore(env, body);
                case "/api/test/credits": return await testCredits(env, body);
                case "/api/redeem": return await redeem(env, body);
                case "/api/ai": return await ai(env, body, req);
                case "/api/fill": return await fill(env, body, req);
                case "/api/pay/init": return await payInit(env, body);
                case "/api/pay/webhook": return await payWebhook(env, body);
                case "/api/admin/codes": return await adminCodes(env, req, body);
                default: return fail("introuvable", 404);
            }
        } catch (e) {
            return fail(String(e.message || e), 500);
        }
    },
};
