// Serveur FAFIO (Cloudflare Workers, offre gratuite) : codes de recharge, paiement Mobile Money (Fapshi), assistant IA.
// IA : Workers AI de Cloudflare (liaison « AI », sans clé) ou, si un secret GEMINI_KEY est ajouté, Gemini.
// Aucun secret dans ce fichier : les clés sont des « secrets » du Worker (GEMINI_KEY, FAPSHI_USER, FAPSHI_KEY, ADMIN_TOKEN).
// Stockage : un espace KV lié sous le nom FAFIO.

const PACKS = {
    p3: { price: 200, credits: 3 },
    p10: { price: 500, credits: 10 },
    p35: { price: 1500, credits: 35 },
};
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

// ---------------------------------------------------------------- Codes de recharge

async function redeem(env, body) {
    const code = String(body.code || "").trim().toUpperCase();
    const device = String(body.device || "").slice(0, 40);
    if (!/^FAF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return fail("code invalide");
    const raw = await env.FAFIO.get("code:" + code);
    if (!raw) return fail("code inconnu", 404);
    const c = JSON.parse(raw);
    if (c.used) return fail("code déjà utilisé", 409);
    c.used = true; c.device = device; c.usedAt = Date.now();
    await env.FAFIO.put("code:" + code, JSON.stringify(c));
    return json({ credits: c.credits });
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

async function ai(env, body, req) {
    const task = TASKS[body.task];
    const text = String(body.text || "").slice(0, MAX_TEXT).trim();
    if (!task) return fail("tâche inconnue");
    if (!text) return fail("texte vide");
    if (!env.GEMINI_KEY && !env.AI) return fail("assistant pas encore activé", 503);
    const who = String(body.device || req.headers.get("CF-Connecting-IP") || "anon").slice(0, 40);
    const key = `ai:${who}:${today()}`;
    const used = parseInt((await env.FAFIO.get(key)) || "0", 10);
    if (used >= AI_PER_DAY) return fail(`limite de ${AI_PER_DAY} demandes par jour atteinte, reviens demain`, 429);
    await env.FAFIO.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
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
    const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return fail((data.error && data.error.message) || "IA indisponible", 502);
    const out = ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!out) return fail("aucune réponse", 502);
    return json({ text: out, left: AI_PER_DAY - used - 1 });
}

// ---------------------------------------------------------------- Routage

export default {
    async fetch(req, env) {
        const url = new URL(req.url);
        if (req.method === "OPTIONS") return json({});
        try {
            if (url.pathname === "/api/health") return json({ ok: true, ai: !!(env.GEMINI_KEY || env.AI), pay: !!(env.FAPSHI_USER && env.FAPSHI_KEY), packs: PACKS });
            if (url.pathname === "/api/pay/status" && req.method === "GET") return await payStatus(env, url);
            if (req.method !== "POST") return fail("introuvable", 404);
            const body = await req.json().catch(() => ({}));
            switch (url.pathname) {
                case "/api/redeem": return await redeem(env, body);
                case "/api/ai": return await ai(env, body, req);
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
