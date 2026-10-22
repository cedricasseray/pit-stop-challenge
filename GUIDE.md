# PIT STOP CHALLENGE – Guide de mise en ligne (Au Paddock Chic)

> État réel : le code de ce dossier est écrit et la logique serveur est testée en local.
> **Rien n'est encore publié, ni connecté à Netlify, Make ou Google Sheets** : ce sont les étapes ci-dessous, à faire par vous.

## 1. Architecture

```
Téléphone ──QR──> Netlify (site statique public/)
                     │  POST /api/start, /api/answer
                     ▼
              Netlify Functions (netlify/functions)
              - banque de questions + bonnes réponses (serveur uniquement)
              - code du cadenas = variable d'environnement PADDOCK_CODE
              - sessions signées (HMAC) : pas de base de données
                     │  webhook JSON (start / fail / win)
                     ▼
                   Make ──> Google Sheet (journal + stats)
                        └─> Gmail (email uniquement si type = win)
```

Le navigateur ne reçoit **jamais** les bonnes réponses ni le code avant le 5e bon résultat.

## 2. Outils
GitHub (code), Netlify (hébergement + fonctions), Make (automatisation), Google Sheets, Gmail, un générateur de QR code. Aucun n'est obligatoire hors Netlify : sans `MAKE_WEBHOOK_URL`, le jeu marche, sans email ni stats.

## 3. Mise en ligne pas à pas
1. Créez un dépôt GitHub privé et envoyez-y tout le contenu du dossier (le `.gitignore` exclut `.env`).
2. Netlify → *Add new site → Import from Git* → choisissez le dépôt. Les réglages viennent de `netlify.toml`.
3. Netlify → *Site configuration → Environment variables*, ajoutez :
   | Variable | Valeur |
   |---|---|
   | `PADDOCK_CODE` | le code à 3 chiffres du cadenas |
   | `TOKEN_SECRET` | une longue phrase aléatoire (≥ 16 caractères) |
   | `MAKE_WEBHOOK_URL` | URL du webhook Make (étape 5) |
4. Redéployez (*Deploys → Trigger deploy*). Notez l'URL, idéalement renommée en `paddock-chic.netlify.app` (*Domain management*).

**Changer le code du cadenas** : modifiez `PADDOCK_CODE` dans Netlify puis redéployez. Aucun fichier à toucher.
**Ajouter/modifier des questions** : `netlify/lib/questions.mjs` (la bonne réponse est toujours la 1re de `a`, le serveur mélange).

## 4. Sécurité
- Code et bonnes réponses : uniquement côté serveur ; introuvables dans le HTML/JS.
- Identifiants de réponses opaques (HMAC) : on ne peut pas deviner la bonne dans le réseau du navigateur.
- Sessions signées : impossible de sauter une question ou de falsifier sa progression.
- Anti-abus : délai minimum 0,7 s par réponse, limite de débit par IP (20 démarrages et 60 réponses / minute, dans `config.rateLimit`), pas de explication donnée après une erreur.
- Limite connue, assumée : sans base de données, une session peut être rejouée (un tricheur patient pourrait essayer les 4 réponses de la dernière question avec un même jeton). Le débit limité et le fait que le code ne fait que 3 chiffres (l'ouvrir au hasard prend le même temps) rendent le gain nul. Pour du verrouillage strict, ajouter Netlify Blobs.
- Aucune donnée personnelle : seul un identifiant aléatoire stocké dans l'appareil.

## 5. Make : email + Google Sheet
1. Google Sheet « Pit Stop Challenge » avec un onglet **Journal** et en ligne 1 :
   `Date | Type | Session | Tentative | Étape`
2. Make → nouveau scénario → module **Webhooks → Custom webhook** → copiez l'URL dans `MAKE_WEBHOOK_URL` (Netlify).
3. Envoyez un test (voir §8) pour que Make apprenne la structure : `type, sid, attempt, step, at, atParis`.
4. Module **Google Sheets → Add a Row** (tous les événements) :
   `atParis | type | sid | attempt | step`
5. Ajoutez un **filtre** `type = win` puis un module **Gmail → Send an Email** (à vous-même) :
   - Objet : `🏁 Pit Stop Challenge réussi – Au Paddock Chic`
   - Corps :
   ```
   Un locataire vient de réussir le Pit Stop Challenge.

   🏆 Challenge : réussi
   📅 Date et heure : {{atParis}}
   🔢 Nombre de tentatives : {{attempt}}
   📱 Session : {{sid}}

   Le code du cadenas a été affiché au joueur.
   ```
   Le module Gmail doit être placé **après** le Sheet avec ce filtre sur la route de l'email (ou via un *Router*).
6. Activez le scénario (*Scheduling : Immediately*).

Coût Make : plan gratuit (1 000 opérations/mois). Chaque partie ≈ 5–10 opérations, soit des dizaines de parties/mois.

## 6. Tableau de suivi (onglet « Stats »)
Types : `start` (début d'une tentative), `fail`, `win`.
| Indicateur | Formule |
|---|---|
| Parties commencées | `=COUNTIFS(Journal!B:B;"start";Journal!D:D;1)` |
| Tentatives | `=COUNTIF(Journal!B:B;"start")` |
| Parties réussies | `=COUNTIF(Journal!B:B;"win")` |
| Taux de réussite | `=IFERROR(B3/B1;0)` |
| Dates des réussites | `=FILTER(Journal!A:A;Journal!B:B="win")` |

(Adaptez les `;` en `,` selon la langue de votre Sheets.)
Note : le compteur de tentatives est mémorisé sur l'appareil ; un nouvel invité sur un autre téléphone repart à 1.

## 7. QR code
1. Une fois l'URL finale connue (`https://paddock-chic.netlify.app`), générez le QR sur qr-code-generator.com ou un outil gratuit de votre choix, en mode **URL statique** (pas de lien de redirection payant).
2. Exportez en SVG/PDF haute définition ; vérifiez avec 2 téléphones (iPhone + Android).
3. Imprimez avec le panneau :
   > 🏁 À VOUS DE JOUER ! — 5 questions. 1 challenge. 1 code secret. Scannez le QR code et tentez votre tour parfait.
   Taille minimale du QR : 3 × 3 cm, fort contraste, plastifié.

## 8. Tester avant d'imprimer
Local (facultatif) : installer Node, `npm i -g netlify-cli`, copier `.env.example` en `.env`, lancer `netlify dev`.
Sur le site publié :
- [ ] Parcours parfait → code affiché = celui du cadenas
- [ ] 1 erreur → écran « Passage aux stands », puis nouvelle partie avec d'autres questions
- [ ] Email reçu avec les bonnes valeurs ; ligne ajoutée dans le Sheet (start/fail/win)
- [ ] Code absent du « Afficher le code source » et des onglets Réseau avant la victoire (cherchez-le)
- [ ] Changer `PADDOCK_CODE`, redéployer, vérifier le nouveau code
- [ ] iPhone Safari + Android Chrome, mode sombre, réseau 4G faible, rotation écran
- [ ] Envoyer 25 requêtes rapides : réponse 429 attendue
- [ ] Vérifier chaque question de la banque (relecture) – surtout si vous en ajoutez

## 9. Coûts estimés
Netlify gratuit (suffisant), Make gratuit, Google gratuit, GitHub gratuit. QR : 0 €. Nom de domaine personnalisé optionnel : ~10–15 €/an.

## 10. Sources des faits Paul Ricard (vérifiés par recherche web)
- Au Castellet (Var), circuit inauguré en 1970 ; Paul Ricard est le fondateur du pastis du même nom (connaissance générale, à relire si vous le souhaitez).
- Premier Grand Prix de France de F1 au circuit : 4 juillet 1971, victoire de Jackie Stewart devant François Cevert.
- Ligne droite du Mistral : environ 1,8 km (chicane ajoutée depuis).
- Zones de dégagement bleues et rouges, en remplacement des bacs à gravier.
Sources : [Wikipedia](https://en.wikipedia.org/wiki/Circuit_Paul_Ricard), [INA](https://fresques.ina.fr/sudorama/fiche-media/00000000282/le-circuit-du-castellet.html), [F1 Fansite](https://www.f1-fansite.com/fr/f1-circuits/circuit-paul-ricard-layout-lap-record/).
Les autres questions (Provence, Var, auto, local) reposent sur des connaissances générales courantes : relisez-les.

## 11. Prompt pour un agent IA (si vous faites évoluer le projet)
> Tu maintiens « Pit Stop Challenge – Au Paddock Chic », un quiz mobile sur Netlify. Règles : ne jamais exposer le code du cadenas ni les bonnes réponses côté client ; toute validation reste dans `netlify/functions`; aucune donnée personnelle ; ton chaleureux, premium, sport automobile et Provence ; chaque nouvelle question doit avoir une réponse factuelle vérifiable, une bonne réponse en 1re position dans `a`, et une explication amusante de 1–2 phrases ; n'invente jamais de fait sur le Circuit Paul Ricard sans source citée.
