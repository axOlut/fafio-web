# Serveur FAFIO (Cloudflare Workers)

Ce petit serveur gratuit fait trois choses :

1. **Codes de recharge** : il vérifie les codes `FAF-XXXX-XXXX` que l'utilisateur tape dans FAFIO et lui ajoute les crédits (un code ne marche qu'une fois).
2. **Paiement Mobile Money** (Fapshi) : sur le site FAFIO, l'utilisateur choisit un pack, paie par Orange Money ou MTN MoMo, et reçoit son code.
3. **Assistant de rédaction** : il transmet les demandes à l'IA Gemini sans jamais montrer ta clé (10 demandes par jour et par appareil).

Aucun mot de passe ni clé n'est écrit dans `worker.js`. Les clés se rangent dans les « secrets » du Worker, invisibles pour tout le monde.

## Les packs (modifiables en haut de `worker.js`)

| Pack | Prix | Crédits |
|---|---|---|
| p3 | 200 FCFA | 3 |
| p10 | 500 FCFA | 10 |
| p35 | 1 500 FCFA | 35 |

1 crédit = 1 document Pro (Word, PowerPoint ou mémoire), réexportable pendant 30 jours.

## Mise en ligne (on le fera ensemble, étape par étape)

1. Dans Cloudflare : **Storage & Databases › KV › Create**, nom `fafio-kv`.
2. Ouvre le Worker `fafio-api` › **Edit code**, colle tout le contenu de `worker.js`, puis **Deploy**.
3. **Settings › Bindings › Add › KV namespace** : nom de la variable `FAFIO`, espace `fafio-kv`.
4. **Settings › Variables and Secrets › Add**, type **Secret** :
   - `GEMINI_KEY` : ta clé Google AI Studio ;
   - `ADMIN_TOKEN` : un long mot de passe inventé (pour créer des codes à la main) ;
   - plus tard, `FAPSHI_USER` et `FAPSHI_KEY` (passerelle de paiement). Pour tester sans vrai argent : variable `FAPSHI_SANDBOX` = `1`.
5. Envoie-moi l'adresse `https://fafio-api.….workers.dev` : je la mets dans l'application et sur le site.

Vérification : ouvre `https://fafio-api.….workers.dev/api/health` dans le navigateur. Tu dois voir `"ok": true`.

## Vendre des crédits à la main (avant la passerelle)

Quelqu'un te paie par Mobile Money ? Crée-lui un code (exemple : 10 crédits) :

```
curl -X POST https://fafio-api.….workers.dev/api/admin/codes \
  -H "Authorization: Bearer TON_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"credits": 10, "count": 1}'
```

Envoie-lui le code reçu (`FAF-…`) par WhatsApp. Il le tape dans **Paramètres › Crédits Pro**.

## Adresses du serveur

| Adresse | Rôle |
|---|---|
| `GET /api/health` | état du serveur |
| `POST /api/redeem` | `{code, device}` → crédits ajoutés |
| `POST /api/ai` | `{task, text, lang, device}` → texte proposé |
| `POST /api/pay/init` | `{pack, redirect}` → lien de paiement |
| `POST /api/pay/webhook` | message de Fapshi (à indiquer dans le tableau de bord Fapshi) |
| `GET /api/pay/status?tx=…` | état du paiement et code |
| `POST /api/admin/codes` | création de codes à la main (protégée) |

À vérifier à l'ouverture du compte Fapshi : les noms exacts des champs de leur API (`/initiate-pay`, `/payment-status`) et l'adresse du webhook.
