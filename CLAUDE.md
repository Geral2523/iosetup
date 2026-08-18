# iosetup.com — guides d'intégration IO-Link

## Le projet

Site de référence en français sur l'**intégration des équipements industriels** :
comment raccorder un capteur ou un actionneur à un automate, de bout en bout.

Chaque guide couvre le parcours complet :
caractéristiques → câblage avec brochage → réglages sur l'appareil →
procédure dans TIA Portal → structure des données process (lue dans l'IODD) →
code en CONT (Ladder) et en SCL → **les pièges de mise en service**.

**Public :** techniciens de maintenance industrielle, automaticiens, intégrateurs,
étudiants BTS MS / CRSA / Bac Pro MELEC.

**L'angle différenciant :** l'information existe, mais elle est éparpillée entre
notices constructeur, portails de support et forums — et surtout, personne ne
publie les pièges. Brochages non standard, contradictions entre documents officiels
d'un même fabricant, limites fonctionnelles cachées. C'est ça, la valeur du site.

**Domaine acheté :** iosetup.com

---

## État actuel

**Étapes 1 (découpage) et 2 (pages statiques) terminées.**

```
data/appareils/<marque>-<ref>.json     une fiche appareil (5 fichiers)
data/familles/<id>.json                une famille IODD (keyence-fr)
data/procedures/<id>.json              une procédure d'intégration (4 fichiers)
data/blocs-systeme/<id>.json           une fiche « bloc système » TIA Portal (6 fichiers)
data/familles-commande/<id>.json       un bloc de commande IO-Link partagé (actionneurs) — nouveau
data/taxonomie.json                    automates, catégories, sous-types, marques, modes, maîtres
iodd/                                  les 4 fichiers IODD bruts
src/render.js                          logique de rendu partagée (Node + navigateur) : construction
                                        d'un guide, title/description SEO, liens de famille
src/styles.css                         CSS partagé entre la maquette et les pages statiques
src/template.html                      la maquette interactive (SPA), DB injectée au build
src/build.js                           génère dist/ : maquette + une page statique par guide
dist/                                  le site généré (à régénérer, jamais édité à la main)
legacy/maquette-site-automatisme.html  l'ancien fichier monolithique, gardé en référence
```

Pour prévisualiser : `node src/build.js` puis servir `dist/` (ex. `python3 -m http.server`
depuis `dist/` — ouvrir en `file://` direct ne réexécute pas forcément le JS partout).

**Schéma d'URL (une page statique par appareil × mode de raccordement, pas par appareil) :**
`/<automate>/<categorie>/<type>/<marque>/<id-appareil>/<mode>/`
ex. `dist/siemens/capteur/niveau/keyence/fr-s01/analogique/index.html`.
Chaque page a son `<title>` et sa `<meta description>` construits depuis les données
(voir `metaFor()` dans `render.js`), un lien vers les autres modes du même appareil, et
un lien vers les appareils de la même famille IODD (voir `familySiblings()`).

Vérifié : rendu de `dist/index.html` identique bit à bit à l'ancienne maquette (hash +
longueur, 8 pages) ; les 8 pages statiques répondent 200, sans `undefined`/`NaN` ; les
liens croisés (autres modes, même famille) résolvent et sont réciproques ; les onglets
CONT/SCL fonctionnent sur la maquette et sur les pages statiques.

**Bug corrigé au passage :** la fonction d'onglet s'appelait `lang()`, qui entre en
conflit avec la propriété DOM `element.lang` dans le contexte d'un `onclick` inline —
l'onglet SCL ne s'affichait donc jamais, y compris dans l'ancienne maquette. Renommée
en `showLang()` partout (render.js, template.html, build.js).

Ajouter un capteur de la famille `keyence-fr` = créer un fichier dans `data/appareils/`,
aucune ligne de code à toucher — la page statique et les liens de famille sont générés
automatiquement.

**Nouveau mode : `profinet` (PROFINET natif, sans maître IO-Link).** Premier appareil qui
s'intègre directement par GSDML plutôt que par IODD — le variateur SINAMICS G120C. La
structure de données process d'un télégramme PROFIdrive se décrit par **mot PZD**, pas par
octet/bit comme une IODD : nouveau bloc `blocProfinet()` dans `render.js` (table, pas bande
d'octets), nouveaux champs sur l'appareil (`gsdml`, `telegrammes`, `telegrammeDocumente`,
`diagnostics`), et `connSvg()` sait maintenant dessiner un connecteur RJ45 en plus du M12.
Sources dans `gsdml/` (2 XML GSDML + bmp), fournies par l'utilisateur — la notice
d'exploitation PDF (caractéristiques électriques, brochage bornier, connecteur X150) a été
récupérée en ligne puis lue directement (pypdf + pymupdf, poppler absent de la machine).
**Le détail bit à bit de STW1/ZSW1 n'est pas dans le GSD** (c'est le profil PROFIdrive,
un standard séparé) — seuls les 4 bits les plus universellement documentés sont repris
dans le code exemple, avec avertissement explicite plutôt que présentés comme vérifiés.

Le site couvre **11 pages** sans erreur, pour 7 appareils :

| Appareil | Marque | Type | Modes de raccordement |
|---|---|---|---|
| LDH292 | ifm | Humidité + température | IO-Link |
| FR-S01 | KEYENCE | Niveau radar courte portée | IO-Link · analogique · TOR |
| FR-LM20 | KEYENCE | Niveau radar longue portée | IO-Link |
| FR-LS20 | KEYENCE | Niveau radar sanitaire | IO-Link |
| SIRIUS 8WD4615-5JH47 | Siemens | Colonne de signalisation, 15 segments | IO-Link · conventionnel 24 V |
| SIRIUS 8WD4613-5JH47 | Siemens | Colonne de signalisation, 9 segments | IO-Link · conventionnel 24 V |
| SINAMICS G120C | Siemens | Variateur de vitesse | PROFINET natif |

**G120X pas encore couvert** — gamme différente, son propre GSDML serait nécessaire.

**Photos produit (nouveau).** Un fichier `src/assets/appareils/<id>.<ext>` s'attache
automatiquement à l'appareil du même `id` — zéro ligne de JSON à toucher, `attachPhotos()`
dans `build.js` scanne le dossier et pose `d.photo` sur l'objet avant la génération.
Rendu dans l'en-tête du guide (`buildGuideArticle`, `.guide-head-photo`) et en vignette
sur les tuiles de l'étape « Quel modèle ? » (`.tile-photo`). Absence de fichier = pas de
photo, aucune erreur. G120C n'en a pas encore. Fichiers sources originaux (avant
renommage par id) conservés dans `src/assets/originaux/appareils/` — même convention que
`logo-source.png`.

**Famille de commande (nouveau, pendant actionneur de la famille IODD).** Les deux colonnes
SIRIUS 8WD46 (8WD4615 15 segments, 8WD4613 9 segments) partagent exactement le même bloc
fonction IO-Link `Control_IOLink8WD46` (entrées/sorties, table couleurs, table effets) —
seule la géométrie physique (nombre de segments) change. Ce bloc partagé vit dans
`data/familles-commande/siemens-8wd46-iolink.json`, référencé par chaque appareil via
`raccordements.iolink.familleCommande` (au lieu de dupliquer `commande` inline). Mécanisme
symétrique à `familleIodd`/`data/familles/` mais côté sortie : `Render.rac()` fusionne les
deux indépendamment (un appareil pourrait en théorie avoir les deux), et
`Render.familySiblings()` matche sur l'une ou l'autre pour générer le lien croisé « Même
famille » sur les pages statiques. Sources vérifiées depuis les fiches techniques Siemens
officielles (8WD4613-5JH47 IO-Link et 8WD4613-5JH37 conventionnel, téléchargées et lues en
PDF — pas de résumé de recherche web fait confiance sans vérification directe, un premier
essai de résumé automatique s'est avéré faux sur plusieurs valeurs).

Fichiers IODD sources dans `iodd/` (ifm LDH292 + les trois KEYENCE de la gamme FR).

**Blocs système TIA Portal (nouveau, indépendant de tout appareil).** Six fiches dans
`data/blocs-systeme/` : `temporisation` (TON/TOF/TP), `compteur` (CTU/CTD/CTUD), `front`
(R_TRIG/F_TRIG), `comparaison-deplacement` (CMP/MOVE/MOVE_BLK), `communication`
(TSEND_C/TRCV_C, MB_CLIENT/MB_SERVER) et `conversion-calcul` (CONV/MOD/ADD-SUB-MUL-DIV).
Chaque fiche a un champ `ordre` (tri d'affichage) et suit le même schéma : `nom`,
`sousTitre`, `resume`, `intro`, `blocs[]` (nom/fonction/description/parametres/quand/piège
par bloc), `exemple.{scl,lad}` (un seul exemple représentatif par fiche, rendu via
`blocProg()`), `pieges[]` (niveau fiche) et `source`. Rendu par `Render.buildBlocArticle()`
dans `render.js` (nouvelle fonction, même structure que `buildGuideArticle()` mais sans
appareil ni mode de raccordement). Pages statiques générées par `buildBlocPages()` dans
`build.js`, sous `/siemens/bloc-systeme/<id>/`. Dans la maquette interactive, accessible
par une tuile « Blocs système » ajoutée sous la grille de catégories à l'étape 2 (juste
après le choix de l'automate) — branche parallèle à Capteurs/Actionneurs/Variateurs, pas
un sous-type de matériel. Ajouter une septième fiche = un fichier JSON de plus dans
`data/blocs-systeme/`, aucune ligne de code à toucher.

---

## Navigation

Entonnoir en 7 étapes, plus une barre de recherche qui court-circuite tout :

```
Accueil → Automate → Catégorie → Sous-type → Marque → Modèle → Mode de raccordement → Guide
```

La recherche est **le vrai point d'entrée** : la majorité des visiteurs arriveront
de Google directement sur une page finale, en tapant une référence.
Chaque page guide doit donc avoir sa propre adresse et son propre titre.

**Le bouton ← du navigateur fait la même chose que le bouton ← Retour du site**
(demande explicite de l'utilisateur, malgré la mise en garde donnée sur le
« back button hijacking » — assumé en connaissance de cause). Deux mécanismes
distincts :
- **Maquette SPA** (`template.html`) : chaque navigation qui rend une vue pousse une
  entrée d'historique (`pushView(v)` → `history.pushState({v, S}, ...)`). Le bouton
  ← Retour appelle directement `history.back()` — c'est littéralement le même
  mécanisme que le bouton du navigateur, pas juste un comportement similaire. Un
  `popstate` restaure `S` et rappelle `render(v)`. Le tout premier rendu utilise
  `replaceState` (pas `pushState`) pour fusionner avec l'entrée déjà créée par le
  navigateur au chargement — sinon, quitter le site depuis l'accueil demanderait
  deux clics au lieu d'un.
- **Pages statiques** (`build.js`, script inline en fin de page) : un capteur de
  `document.referrer` — si l'origine ne correspond pas au site (arrivée depuis
  Google, lien externe, URL tapée), on pousse une entrée factice et on intercepte le
  `popstate` pour rediriger vers `/` via `location.replace()` (surtout pas
  `location.href`, qui empilerait une entrée en trop et forcerait un troisième
  retour au lieu de deux). Si on arrive depuis une autre page du site (lien « autres
  modes », « même famille »), le referrer correspond et on ne touche à rien — le
  retour natif fonctionne déjà correctement tout seul.
Testé en conditions réelles dans le navigateur (pas seulement en théorie) : 6 aller
+ 6 retour dans la maquette restituent exactement les mêmes vues dans l'ordre
inverse, sortie propre au 7ᵉ ; page statique arrivée « de l'extérieur » → 1er retour
sur l'accueil, 2ᵉ retour quitte le site ; page statique arrivée par un lien interne →
comportement natif intact.

---

## Les cinq leçons de structure

Chacune vient d'un appareil qui a cassé le modèle. **Ne pas les perdre.**

### 1. Le mode de raccordement est un axe à part entière
Un même capteur en IO-Link, en 4-20 mA ou en tout ou rien n'a **rien de commun**
côté TIA Portal. En analogique il n'y a ni maître, ni GSDML, ni IODD — juste une
carte d'entrées analogiques et un NORM_X / SCALE_X.
→ Révélé par le KEYENCE FR-S01.

### 2. Le brochage n'est JAMAIS générique
L'ifm LDH292 : M12 4 broches, C/Q en broche 4.
Le KEYENCE FR-S01 : M12 8 broches, IO-Link en broche 6 (fil rose).
→ Le brochage est une donnée par appareil, jamais un texte réutilisé.

**Corollaire important :** l'IODD sert aux **données process et aux paramètres**,
**jamais au câblage**. Les trois IODD KEYENCE déclarent toutes un M12 4 broches
avec un fil noir — ce sont les couleurs standard DIN EN 60947-5-2, du remplissage
générique. Le câble réel n'a aucun fil noir. Pour le câblage : notice constructeur.

### 3. Le bon grain est la FAMILLE IODD, pas l'appareil
Les trois IODD KEYENCE de la gamme FR (DeviceID 2040, 2041, 2042) ont une
structure de données process **rigoureusement identique** — 96 bits, 12 octets,
25 éléments aux mêmes offsets. Deux libellés diffèrent seulement :
« niveau cumulé » (courte portée) devient « valeur de conversion de débit »
(longue portée).
→ La famille est définie une fois dans `DB.famillesIodd`, les appareils y
réfèrent via `familleIodd` + `variante`. Ajouter un capteur de la gamme =
quelques lignes de données, zéro ligne de code.

### 4. Le sens des données change tout
Un capteur remonte des données (ProcessDataIn). Un actionneur en reçoit
(ProcessDataOut). Pour la colonne 8WD46, il n'y a pas de trame d'octets à décoder :
Siemens fournit un bloc fonction `Control_IOLink8WD46` qu'on appelle.
→ Champ `sens: 'sortie'` et bloc `commande` au lieu du bloc `donnees`.

### 5. La taxonomie dépend de la catégorie
Un capteur se classe par **grandeur mesurée** (température, niveau, pression).
Un actionneur par **fonction** (signalisation, vannes, vérins).
→ `DB.sousTypes` est un objet indexé par catégorie, pas une liste unique.

---

## Cinq procédures d'intégration, pas une

- **`iolink-profinet`** — maître IO-Link + GSDML **du maître**, configuration dans TIA
- **`analogique-ai`** — carte d'entrées analogiques, NORM_X / SCALE_X, aucun IO-Link
- **`iolink-s7pct`** — passe par **S7 Port Configuration Tool**, un logiciel séparé
  à installer, avec son propre catalogue et son propre « charger dans les appareils »
- **`tor-di`** — sorties de commutation sur carte d'entrées TOR
- **`profinet-drive`** — pas de maître intermédiaire : GSDML **de l'appareil final**
  lui-même, télégramme PROFIdrive choisi dans ses propriétés, mise en service Startdrive

---

## Ce qu'il faut faire maintenant

### Étape 1 — Découper ✅ fait
### Étape 2 — Générer du HTML statique ✅ fait
### Étape 3 — Mettre en ligne ✅ fait
Voir « État actuel » ci-dessus.

**Site en ligne sur https://iosetup.com et https://www.iosetup.com** (SSL actif).
Chaîne de déploiement :
- Dépôt GitHub public : [github.com/Geral2523/iosetup](https://github.com/Geral2523/iosetup),
  accès de l'app Cloudflare restreint à ce seul dépôt.
- Cloudflare Pages, projet `iosetup` — build command `node src/build.js`, dossier de
  sortie `dist`. Chaque push sur `main` republie automatiquement le site.
- DNS de iosetup.com basculé chez Cloudflare (nameservers `roman`/`rosalyn.ns.cloudflare.com`,
  remplaçant les DNS OVH). Domaine personnalisé + `www` configurés sur le projet Pages.
- Fallback toujours disponible : `iosetup.pages.dev`.

Comptes utilisés : GitHub `Geral2523`, Cloudflare `05.honnete.survol@icloud.com` (créé pour
ce projet), domaine toujours enregistré chez OVH (seul le DNS a été délégué à Cloudflare).

### Étape 4 — Référencement ✅ sitemap fait, inscription Search Console à finaliser par l'utilisateur
`sitemap.xml` et `robots.txt` sont générés automatiquement par `build.js`
(`buildSitemap()`, `buildRobots()`) — une entrée par page réelle (accueil, chaque guide
appareil × mode, chaque fiche bloc système), reconstruite depuis `Render.guidePath()` /
`Render.blocSystemePath()`, donc jamais désynchronisée d'une page qui existe vraiment.
18 URLs au 2026-08-18. Reste à faire par l'utilisateur (nécessite sa connexion Google) :
créer la propriété iosetup.com sur Google Search Console, vérifier (le plus simple est un
enregistrement DNS TXT via Cloudflare, pas une balise HTML), puis soumettre
`https://iosetup.com/sitemap.xml`. Indexation pas instantanée même après ça — plutôt des
jours que des mois une fois le sitemap soumis.

**Mesure d'audience :** demandée par l'utilisateur, pas encore choisie/mise en place —
proposé Cloudflare Web Analytics (gratuit, sans cookie, déjà sur Cloudflare) plutôt que
Google Analytics (cookies → bandeau RGPD requis) mais pas encore confirmé.

### Étape 5 — Un script de vérification
Générer toutes les pages hors navigateur et signaler celles qui plantent.
À 4 appareils on trouve à l'œil, à 300 non.
*(Un bug de routage a déjà été trouvé exactement comme ça.)*

---

## Notes de travail

- **L'esthétique vient à la fin** — mais la lisibilité mobile n'est pas de
  l'esthétique : le lecteur type est debout devant une machine, sur un téléphone,
  parfois à 22 h. C'est de la fonction, et Google en tient compte.
- **Ne jamais utiliser de matériel, de code ou de captures appartenant à
  l'employeur.** Refaire les projets TIA de zéro, sans référence machine ni nom
  de client.
- **Marquer ce qui n'est pas vérifié.** Le code est généré depuis la documentation,
  pas testé sur installation. Les pages le signalent explicitement — garder cette
  honnêteté, c'est ce qui fera la réputation du site.
- **Différence entre fabricants à documenter :** ifm publie tout en accès libre,
  IODD comprise, sur l'IODDfinder. KEYENCE distribue les siennes depuis son propre
  site. C'est une information utile au lecteur au moment de choisir un capteur, et
  personne ne la publie.

---

## Prochaines sources déjà repérées

- Gamme KEYENCE FR complète (les IODD FR-L et FR-LS sont déjà dans `/iodd/`)
- Fabricants à couvrir ensuite : SICK, Balluff, Turck
- Mode analogique de la longue portée KEYENCE (non encore documenté sur le site)
- Données process IO-Link du FR-S01 : présentes dans l'IODD, déjà intégrées
