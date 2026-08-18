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

Le site couvre **30 pages** sans erreur, pour 11 appareils (dont pages « voie IO-Link »
supplémentaires pour les capteurs — voir section Navigation) :

| Appareil | Marque | Type | Modes de raccordement |
|---|---|---|---|
| LDH292 | ifm | Humidité + température | IO-Link |
| FR-S01 | KEYENCE | Niveau radar courte portée | IO-Link · analogique · TOR |
| FR-LM20 | KEYENCE | Niveau radar longue portée | IO-Link |
| FR-LS20 | KEYENCE | Niveau radar sanitaire | IO-Link |
| PN7093 | ifm | Pression relative 0…25 bar | IO-Link |
| SIRIUS 8WD4615-5JH47 | Siemens | Colonne de signalisation, 15 segments | IO-Link · conventionnel 24 V |
| SIRIUS 8WD4613-5JH47 | Siemens | Colonne de signalisation, 9 segments | IO-Link · conventionnel 24 V |
| SINAMICS G120C | Siemens | Variateur de vitesse | PROFINET natif |
| FD-H20 | KEYENCE | Débit + température de tuyau (sonde intégrée) | IO-Link |
| FI-1000 | KEYENCE | Unité d’affichage multiprocessus (+ FI-T sur Multiport) | IO-Link |
| FI-T | KEYENCE | Température de tuyau, usage autonome | IO-Link |

**G120X pas encore couvert** — gamme différente, son propre GSDML serait nécessaire.

**PN7093 (ifm, pression) — premier appareil hors familles capteur déjà connues, deux bugs
génériques trouvés et corrigés en le construisant.** Données process sur 16 bits (2 octets)
seulement, PAS alignées sur les octets — pression sur les bits 15-2 (14 bits, ÷10 → bar),
état OUT2 sur le bit 1, état OUT1 sur le bit 0 (source : IODD officiel téléchargé depuis
IODDfinder, `vendors/310/iodds/89`, pas juste la notice — la notice PN70xx elle-même ne
donne pas cette structure bit à bit). Ce packing bit-level (plusieurs grandeurs dans un
même octet) est une première sur le site — jusqu'ici chaque grandeur occupait un octet
entier ou plus. Deux bugs révélés à la construction, tous deux dans `render.js` :
1. Le texte « Exemple de lecture » de `blocIolink()` était codé en dur avec les valeurs du
   LDH292 (« 43,5 % RH »/« −8,5 °C ») — correct pour ce premier appareil, faux pour tous
   les suivants, personne ne s'en était rendu compte. Corrigé : nouveau champ
   `raccordements.iolink.exempleLecture` (tableau de `{raw, octets, valeur}`) porté par
   chaque appareil ; le LDH292 a été migré pour préserver son texte existant à l'identique.
2. Le code SCL/CONT généré par défaut (`codeSclIolink`/`codeLadIolink`) était en réalité
   le code spécifique du LDH292 (`humRaw`, `tempRaw`, NoData 32764…), présenté comme le
   cas générique — un deuxième appareil KEYENCE avait déjà nécessité un contournement
   (`codeSclFRS`/`familleIodd === 'keyence-fr'`), mais aucun troisième cas n'avait encore
   testé ce chemin par défaut. Résolu avec la même logique que pour KEYENCE : nouvelles
   fonctions `codeSclPN7093`/`codeLadPN7093`, sélectionnées sur `d.id === 'pn7093'` dans
   `buildGuideArticle()`. Pas de généralisation abstraite tentée : chaque appareil au
   packing de données suffisamment différent aura son propre générateur de code, pas une
   fonction générique paramétrée — cohérent avec le reste du site (une procédure = une
   vraie forme de complexité, jamais de texte conditionnel générique).
Catégorie « pression » activée automatiquement dans l'entonnoir (mécanisme dynamique
`usedTypes` déjà en place, zéro ligne de taxonomie à toucher). La voie IO-Link
(S7-PCT vs maître générique) s'applique aussi automatiquement à ce capteur, sans code
supplémentaire — confirmé en testant après ajout.

**FD-H20 (KEYENCE, débitmètre à clipser) — premier appareil dont la structure de données
process est elle-même un paramètre reconfigurable, pas une constante de l'IODD, et un
vrai bug générique corrigé dans `connSvg()`.** Sources : manuel FD-H (AS_149495,
17982FR) + IODD officiel `KEYENCE-FD-H20-20240108-IODD1.1.xml`, les deux fournis
directement par l'utilisateur dans `iodd/` et `manuel/` — contournement du blocage
initial (le manuel/IODD KEYENCE sont derrière un formulaire de création de compte sur
keyence.com, jamais franchi même autorisé ; l'utilisateur les a téléchargés lui-même).
Le paramètre IO-Link « IO-Link process data » (index 4009) bascule entre trois
dispositions de trame totalement différentes (Flow/Multi/Heat) — cette fiche documente
uniquement la disposition par défaut (« 0_Flow rate »), avec un `avertissementIodd`
explicite à ce sujet. Autre première : le facteur d'échelle du débit lui-même est un
paramètre IO-Link en lecture seule (résolution ×0,001 ou ×0,01 pour l'instantané, ×0,0001
ou ×0,001 pour le cumulé — index 4010/4011), pas une constante fixée par l'IODD comme
pour les appareils précédents du site.
Bug générique trouvé et corrigé dans `render.js` : la ligne « Conversion » du tableau de
`blocIolink()` affichait toujours « ÷ 10 → unité », codé en dur, alors que jusqu'ici tous
les appareils du site avaient effectivement un gradient de 0,1 (LDH292, PN7093) — jamais
testé avec une autre valeur. Le FD-H20 a un gradient de 0,001 (débit) et 0,0001 (débit
cumulé) : la ligne affichait « ÷ 10 » au lieu de « ÷ 1000 »/« ÷ 10000 ». Corrigé en
calculant le diviseur depuis `x.gradient` (`Math.round(1 / x.gradient)`) au lieu du texte
figé. Deuxième bug trouvé et corrigé dans `connSvg()` : la détection « connecteur 8
broches vs 4 broches » se faisait par une recherche `/8/.test(r.connecteur)` dans le texte
libre du champ `connecteur` — le FD-H20 a un port natif 8 broches mais se raccorde en
IO-Link via un adaptateur 4 broches (FD-HCC2/10/0), et le texte décrivant ce fait mentionne
« 8 » sans que le brochage IO-Link documenté en compte 8. Corrigé : le nombre de broches se
lit désormais sur `Math.max(...r.pinout.map(p => p.n))`, jamais sur une recherche de texte.
Catégorie « débit » activée automatiquement (mécanisme `usedTypes`, déjà en place).
Code SCL/CONT dédié à l'origine (`codeSclFDH20`/`codeLadFDH20`, sélectionné sur
`d.id === 'fd-h20'`) — **renommé `codeSclMultiprocess`/`codeLadMultiprocess` et sélectionné
sur `r.familleIodd === 'keyence-multiprocess'` dans la même session**, une fois le FI-1000
confirmé comme un deuxième appareil partageant exactement cette trame (voir plus bas) —
même principe que PN7093/FR-S01 : chaque *structure* suffisamment différente a son propre
générateur, mutualisé entre appareils seulement quand un deuxième cas réel le confirme,
jamais anticipé.

**FI-1000 et FI-T (KEYENCE) — même session, ajoutés à la demande de l'utilisateur qui avait
aussi déposé leurs manuels/IODD dans `iodd/`/`manuel/` sans le signaler d'emblée.**
Découverte importante en lisant le manuel FI-1000 : ce n'est **pas** un capteur de
concentration comme son nom le suggérait au premier abord, mais une **unité d'affichage
multiprocessus** — littéralement le même boîtier/firmware IO-Link que le FD-H, mais sans
sonde de débit intégrée ; il faut lui connecter un débitmètre FD-R (port arrière dédié) ou
un capteur satellite Multiport (FI-T, FI-C, FR) pour qu'il mesure quoi que ce soit. Vérifié
en diffant les deux IODD (`KEYENCE-FD-H20-...` vs `KEYENCE-FI-1000-...`, script Python
comparant bitOffset/type de chaque RecordItem) : structure de données process **identique
bit pour bit** (mêmes 3 dispositions Flow/Multi/Heat, mêmes offsets, `dataStorage=true`
sur les deux) malgré des DeviceID différents (2016 vs 2025) — première vraie famille IODD
inter-appareils du site où la ressemblance n'était pas évidente a priori (contrairement à
`keyence-fr`, où les 3 appareils sont ouvertement la même gamme). Refactorisé en
conséquence : nouvelle `data/familles/keyence-multiprocess.json` (trame, `donnees`,
`bitsDiag`, `avertissementIodd` communs), FD-H20 migré pour la référencer via
`familleIodd` au lieu de dupliquer sa trame inline — exactement le mécanisme déjà en place
pour `keyence-fr`, appliqué ici a posteriori une fois la famille confirmée par un second
appareil réel (jamais anticipée).
Le FI-T, lui, a **deux identités IO-Link complètement séparées** documentées dans le même
manuel sans que ce soit dit explicitement : connecté au Multiport d'un FD-H/FI-1000 (il
perd alors son IO-Link propre, ses réglages se pilotent depuis l'unité hôte), ou
**autonome**, avec son propre port M8 4 broches et sa propre trame IO-Link (32 bits,
DeviceID 2026 — sans commune mesure avec celle du FD-H/FI-1000). C'est cet usage autonome
qui est documenté sur le site (`codeSclFIT`/`codeLadFIT`, structure dédiée). La fiche
FI-1000 construite en parallèle illustre l'*autre* mode : un FI-T câblé sur son Multiport,
dont la température apparaît dans le champ « Température 1 » de la trame FI-1000/FD-H
partagée (ordre de priorité documenté : FI-T > sonde intégrée FD-H > FI-C).
Deux bugs génériques supplémentaires trouvés et corrigés dans `render.js`, tous deux
révélés par le FI-T (M8) et par FR-LM20/FR-LS20 (famille `keyence-fr` déjà en place) :
1. `connSvg()` étiquetait tout connecteur rond à 4 broches « Brochage M12 4 broches »,
   même quand le connecteur réel est un M8 (FI-T) — cosmétique mais factuellement faux.
   Corrigé : aria-label générique « Brochage 4 broches », sans présumer du diamètre.
2. `codeSclFRS` (le générateur SCL partagé par toute la famille `keyence-fr`) déclarait
   un bloc nommé en dur `FUNCTION_BLOCK "FB_FR_S01"` **même sur les pages FR-LM20 et
   FR-LS20** — un technicien suivant le guide FR-LM20 aurait obtenu du code appelé
   « FB_FR_S01 ». Personne ne l'avait remarqué car le nom du bloc n'apparaît qu'en usage
   réel, jamais testé jusqu'ici sur un appareil différent du premier de la famille.
   Corrigé : nom dynamique `FB_${d.ref.replace(/-/g, '_')}` — appliqué du même coup à
   `codeSclMultiprocess`/`codeSclFIT`, qui ne reproduisent pas l'erreur.
Catégorie « température » (déjà active via LDH292) réutilisée pour les deux — choix
assumé : la grandeur documentée pour le FI-1000 dépend entièrement de l'accessoire
connecté, « température » correspond à la configuration réellement construite ici.

**Bug utilisateur signalé et corrigé (même session) : badge « Bientôt » affiché à tort
sur des sous-types qui ont pourtant un appareil réel (Débit, Pression), repéré par
l'utilisateur directement sur le site en production après le push.** Cause : dans
`template.html`, la fonction `tiles()` calcule le badge Disponible/Bientôt depuis
`x.actif` — le champ **statique** de `taxonomie.json` — alors que les étapes « catégorie »,
« grandeur mesurée » et « marque » filtrent déjà dynamiquement leur liste via
`usedCategories`/`usedTypes`/`usedMarques` (calculés depuis `DB.appareils`). Une entrée
comme `pression`/`debit` garde `actif:false` dans `taxonomie.json` (elle n'a jamais besoin
d'être mise à `true` à la main, c'est tout l'intérêt du mécanisme dynamique) — mais
`tiles()` relisait ce `false` pour le badge, après que le filtre dynamique avait déjà
laissé passer la tuile parce qu'un appareil existe. La correction déjà en place pour
l'étape « modèle » (ligne `l.map(d=>({...,actif:true}))`) n'avait jamais été répliquée sur
les trois autres étapes filtrées dynamiquement. Corrigé aux trois endroits
(`categorie`, `type`, `marque`) : `.map(x=>({...x,actif:true}))` après le filtre — tout
élément qui passe un filtre `usedXxx` a par construction un appareil réel, le badge peut
l'affirmer sans relire `taxonomie.json`. Reproductible avec `sick`/`balluff` (encore
`actif:false`, aucun appareil) le jour où un premier appareil de ces marques sera ajouté,
si ce correctif n'existait pas.

**Revue qualité/SEO du site demandée par l'utilisateur (même session) — six points identifiés
en auditant le site en production, cinq corrigés dans la foulée.** Vérifié directement sur
`iosetup.com` (curl + navigateur), pas seulement en théorie :

1. **La page d'accueil n'avait ni meta description, ni Open Graph, ni canonical** —
   contrairement à chaque page de guide (`metaFor()` en générait déjà). Corrigé : ajoutés en
   dur dans `template.html` pour l'accueil (contenu fixe, une seule page) ; `pageTemplate()`
   dans `build.js` génère désormais aussi OG/Twitter Card pour les pages de guides et de
   blocs système, avec `og:image` = photo de l'appareil si elle existe, sinon le logo.
2. **Aucune page légale, à propos ou contact nulle part sur le site** — pas de footer du
   tout. Ajouté : `buildLegalPage()` dans `build.js` génère `/mentions-legales/` (éditeur,
   hébergeur, à propos, fiabilité du contenu, contact) ; un `<footer class="site-footer">` y
   renvoie depuis `pageTemplate()` (pages statiques) et `template.html` (maquette SPA).
   **Piège rencontré en le construisant :** `.guide-head` a une règle CSS mobile
   (`flex-direction:column-reverse`) pensée pour exactement deux enfants directs
   (`.guide-head-text` + `.guide-head-photo`, pour afficher la photo au-dessus du titre sur
   petit écran) — la première version de la page légale mettait step/h1/lede directement
   dans `.guide-head` sans le wrapper `.guide-head-text`, ce qui inversait leur ordre
   d'affichage sur mobile (lede, puis titre, puis label, dans cet ordre visuel absurde).
   Corrigé en respectant la structure à deux enfants attendue.
3. **Cloudflare Web Analytics supposé actif ne l'était pas** — vérifié dans le HTML servi
   (aucun script `cloudflareinsights`/`beacon.min.js`), contredisant ce qui était noté en
   mémoire. Reste à activer manuellement par l'utilisateur dans le dashboard Cloudflare
   (Analytics → Web Analytics → Setup) — hors de portée de ce qui est généré par le build.
4. **Aucune donnée structurée** — ajouté un `BreadcrumbList` JSON-LD (2 niveaux : Accueil +
   page courante) sur chaque page statique via `pageTemplate()`. Volontairement pas de
   niveaux intermédiaires (catégorie/type/marque) : ce sont des étapes de l'entonnoir SPA,
   pas de vraies URLs navigables, les inclure dans le balisage aurait pointé vers des
   ressources qui n'existent pas.
5. **robots.txt bloque les robots IA** (ClaudeBot, GPTBot, Google-Extended, etc.) — géré par
   Cloudflare au niveau du edge (bloc « Managed content », pas généré par `buildRobots()`),
   probablement la fonctionnalité « AI Scrapers and Crawlers » activée sur le compte.
   Décision utilisateur en attente — pas quelque chose que Claude peut trancher seul.
6. **Mise en page desktop trop large** — `.wrap` (utilisé par le header, le fil d'Ariane ET
   le contenu principal) passé de `max-width:1080px` à `860px` dans `styles.css`. Vérifié
   avant/après : le tableau de caractéristiques passe de 982px à 762px de large à une
   fenêtre de 1280px, sans rien changer sur mobile (padding latéral fixe, jamais le facteur
   limitant en dessous de 860px de large). Un septième point (catalogue encore restreint à
   11 appareils) a été noté mais n'est pas quelque chose à « corriger » — c'est le stade
   actuel du projet, pas un bug.

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

**Étape 7 bis (nouveau) : « Quel maître IO-Link ? »** — insérée entre le mode de
raccordement et le guide, mais **seulement pour un capteur en IO-Link** (jamais un
actionneur — `raccordements.iolink.sens !== 'sortie'`, sinon la procédure est déjà
figée par les besoins de paramétrage acyclique de l'appareil, ex. SIRIUS 8WD46 =
S7-PCT obligatoire). Catalogue `DB.voiesIolink` dans `taxonomie.json` (2 entrées :
`al1102` — maître PROFINET générique, GSDML direct dans TIA, sans S7-PCT — et
`s7pct` — maître Siemens configuré par S7-PCT). Le brochage et le câble ne changent
pas selon le maître (propriété du capteur) ; seule la procédure TIA Portal affichée
change, via `Render.rac(DB, d, mode, voieId)` qui substitue `procedure` (et,
seulement sur la voie non par défaut, `maitre`). **Piège évité pendant le
développement :** écraser `maitre` inconditionnellement sur la voie par défaut
aurait affirmé à tort une compatibilité AL1102 vérifiée pour des capteurs d'autres
marques (KEYENCE, etc.) qui n'ont jamais été testés avec ce maître précis — corrigé
en ne touchant `maitre` que sur la voie `s7pct` (mise à `null`, maître générique
sans référence précise), jamais sur la voie par défaut qui garde la valeur déjà
déclarée par l'appareil (`null` pour la plupart, `al1102` seulement pour le LDH292,
un capteur ifm réellement testé sur le maître ifm).

URL : la voie par défaut (`al1102`) garde l'URL déjà indexée, sans suffixe — pour
ne rien casser côté Search Console/sitemap déjà soumis. Seule la voie `s7pct`
ajoute un segment : `.../<mode>/s7pct/`. Nouvelle procédure dédiée
`data/procedures/iolink-s7pct-capteur.json`, distincte de `iolink-s7pct`
(actionneurs) — la procédure actionneur nomme un catalogue S7-PCT précis
(« SIRIUS signaling columns »), pas réutilisable telle quelle pour un capteur
générique ; plutôt que du texte conditionnel dans une procédure, une procédure à
part, cohérente avec le principe déjà en place ailleurs sur le site (une procédure
= une vraie forme de complexité, pas un bloc générique avec des branches).
Lien croisé entre voies sur les pages statiques (`otherVoiesHtml()` dans
`build.js`), même mécanique que « Autres modes »/« Même famille ».
Étape SPA correspondante (`v==='voie'` dans `template.html`) intégrée à la
parité bouton retour déjà en place (`pushView`/`popstate`) — testée en conditions
réelles (aller/retour dans le navigateur) après implémentation.

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
  à installer, avec son propre catalogue et son propre « charger dans les appareils ».
  Porte un champ `avertissement` (nouveau, rendu par `render.js` comme note d'alerte
  après le tableau d'étapes) : S7-PCT ne configure que les maîtres IO-Link Siemens,
  pas les maîtres tiers (Balluff, Turck…) même déclarés via leur propre GSDML — point
  de confusion récurrent sur le forum de support officiel Siemens, jamais écrit noir
  sur blanc dans un manuel. Ce champ `avertissement` est un mécanisme générique
  disponible sur n'importe quelle procédure, pas spécifique à celle-ci.
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

**Mesure d'audience :** toujours pas active — confirmé par vérification directe du HTML
servi en production (aucun script `cloudflareinsights`/`beacon.min.js`), malgré une note de
mémoire antérieure affirmant à tort que c'était « déjà actif automatiquement ». Cloudflare
Web Analytics reste la proposition retenue (gratuit, sans cookie, déjà sur Cloudflare) mais
l'activation elle-même (Analytics → Web Analytics → Setup dans le dashboard) doit être faite
manuellement par l'utilisateur — ce n'est pas quelque chose que `build.js` peut générer.

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
