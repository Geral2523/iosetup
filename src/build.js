#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Render = require('./render.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SITE_URL = 'https://iosetup.com';

/* Cache-busting : un hash court du contenu des assets statiques (CSS, JS
   partagé, logo, favicons). Injecté en ?v=... sur leurs URLs pour qu'un
   navigateur ou le cache Cloudflare qui aurait gardé une ancienne version
   récupère automatiquement la nouvelle au prochain déploiement. */
function computeAssetVersion(assetsDir) {
  const hash = crypto.createHash('md5');
  hash.update(fs.readFileSync(path.join(__dirname, 'styles.css')));
  hash.update(fs.readFileSync(path.join(__dirname, 'render.js')));
  for (const f of ['logo.png', 'demo.mp4', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
    hash.update(fs.readFileSync(path.join(assetsDir, f)));
  }
  return hash.digest('hex').slice(0, 10);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readDir(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    out[path.basename(f, '.json')] = readJson(path.join(dir, f));
  }
  return out;
}

/* Photo produit optionnelle : un fichier src/assets/appareils/<id>.<ext>
   s'attache automatiquement à l'appareil du même id, sans toucher au
   JSON — même philosophie que « ajouter un appareil = zéro ligne de
   code ». Absent = simplement pas de photo sur la fiche. */
const APPAREILS_ASSETS_DIR = path.join(__dirname, 'assets', 'appareils');
function attachPhotos(appareils) {
  if (!fs.existsSync(APPAREILS_ASSETS_DIR)) return;
  const files = fs.readdirSync(APPAREILS_ASSETS_DIR);
  for (const d of appareils) {
    const match = files.find(f => f.replace(/\.[^.]+$/, '') === d.id);
    if (match) d.photo = '/assets/appareils/' + match;
  }
}

function buildDB() {
  const taxonomie = readJson(path.join(DATA, 'taxonomie.json'));
  const procedures = readDir(path.join(DATA, 'procedures'));
  const famillesIodd = readDir(path.join(DATA, 'familles'));
  const famillesCommande = readDir(path.join(DATA, 'familles-commande'));
  const appareilsDir = path.join(DATA, 'appareils');
  const appareils = fs.readdirSync(appareilsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(appareilsDir, f)));
  attachPhotos(appareils);
  const blocsSystemeDir = path.join(DATA, 'blocs-systeme');
  const blocsSysteme = fs.readdirSync(blocsSystemeDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(blocsSystemeDir, f)))
    .sort((a, b) => a.ordre - b.ordre);

  return {
    automates: taxonomie.automates,
    categories: taxonomie.categories,
    sousTypes: taxonomie.sousTypes,
    marques: taxonomie.marques,
    modes: taxonomie.modes,
    maitres: taxonomie.maitres,
    voiesIolink: taxonomie.voiesIolink,
    procedures,
    famillesIodd,
    famillesCommande,
    appareils,
    blocsSysteme
  };
}

/* ── la maquette interactive : un seul fichier, navigable, pratique pour se repérer ── */
function buildMaquette(db, distDir, assetV) {
  const templatePath = path.join(__dirname, 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  const marker = /\/\*__DB_JSON__\*\/null\/\*__END_DB_JSON__\*\//;
  if (!marker.test(template)) {
    throw new Error('Placeholder __DB_JSON__ introuvable dans template.html');
  }
  const out = template
    .replace(marker, JSON.stringify(db))
    .replace(/__ASSET_V__/g, assetV);
  fs.writeFileSync(path.join(distDir, 'index.html'), out);
}

/* ── chrome de page statique autour de l'article de guide ── */
function pageTemplate({ title, description, canonical, image, breadcrumb, articleHtml, otherModesHtml, familyHtml, assetV, hideModelNote }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="IO Setup">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico?v=${assetV}" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=${assetV}">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=${assetV}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${assetV}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${assetV}">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: title, item: canonical }
  ]
})}</script>
<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "f3403a92a17f469b8eb37c263006394d"}'></script><!-- End Cloudflare Web Analytics -->
</head>
<body>

<div class="topbar">
<header>
  <div class="wrap hbar">
    <a class="logo" href="/" style="text-decoration:none"><img src="/assets/logo.png?v=${assetV}" alt="IO Setup"></a>
  </div>
</header>

<nav class="crumbs"><div class="wrap"><a class="back" href="/">← Tous les guides</a>${breadcrumb}</div></nav>
</div>
<main class="wrap">
${articleHtml}
${otherModesHtml}
${familyHtml}
${hideModelNote ? '' : `<div class="model-note"><b>À propos de cette page</b>
  Cette page est générée depuis des fiches de données structurées, pas écrite à la main —
  voir <a href="/" style="color:inherit">la maquette interactive</a> pour naviguer parmi tous les guides.</div>`}
</main>

<footer class="site-footer"><div class="wrap">
  <a href="${LEGAL_PATH}">Mentions légales · à propos · contact</a>
  <span>Une erreur sur cette page ? <a href="mailto:georgesalexandre25@gmail.com">Signalez-la</a>.</span>
</div></footer>

<script>
function showLang(id,btn){
  document.querySelectorAll('.lang').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('lang-'+id).classList.add('on');btn.classList.add('on');
}
/* Bouton ← du navigateur = bouton ← Tous les guides du site, mais
   seulement quand on arrive d'ailleurs (recherche Google, lien externe,
   URL tapée directement) : dans ce cas il n'existe pas de page interne
   précédente vers laquelle revenir nativement, donc sans ça le clic
   quitte le site plutôt que de proposer la page d'accueil. Si on arrive
   depuis une autre page du site (lien "autres modes", "même famille"),
   le bouton natif retourne déjà correctement à cette page — on n'y
   touche pas. */
(function(){
  var sameSite = document.referrer && new URL(document.referrer).origin === location.origin;
  if (sameSite) return;
  history.pushState({guard:true}, '', location.href);
  window.addEventListener('popstate', function(){
    location.replace('/');
  });
})();
</script>
</body>
</html>`;
}

function breadcrumbHtml(DB, d, md, voie) {
  const a = DB.automates.find(x => x.id === 'siemens');
  const c = DB.categories.find(x => x.id === d.categorie);
  const t = DB.sousTypes[d.categorie].find(x => x.id === d.type);
  const m = DB.marques.find(x => x.id === d.marque);
  const seg = (txt) => `<span class="now">${Render.esc(txt)}</span>`;
  const segs = [`<a href="/">Accueil</a>`, seg(a.nom), seg(c.nom), seg(t.nom), seg(m.nom), seg(d.ref), seg(md.nom)];
  if (voie) segs.push(seg(voie.nom));
  return segs.join('<span class="sep">›</span>');
}

/* ── capteur IO-Link : lien croisé vers l'autre voie (maître) pour le même appareil ── */
function otherVoiesHtml(DB, d, voieId) {
  if (!DB.voiesIolink) return '';
  const autres = DB.voiesIolink.filter(v => v.id !== voieId);
  if (!autres.length) return '';
  const items = autres.map(v => {
    const href = Render.guidePath('siemens', d, 'iolink', v.id);
    return `<li><a href="${href}">${Render.esc(d.ref)} via ${Render.esc(v.nom)}</a></li>`;
  }).join('');
  return `<div class="note info"><b>Autre maître IO-Link possible pour ${Render.esc(d.ref)}</b>
    <p style="margin:0 0 8px">Le brochage du capteur ne change pas — seule la procédure TIA Portal diffère selon le maître utilisé.</p>
    <ul style="margin:0;padding-left:18px">${items}</ul></div>`;
}

function otherModesHtml(DB, d, currentMode) {
  const modes = Object.keys(d.raccordements).filter(m => m !== currentMode);
  if (!modes.length) return '';
  const items = modes.map(m => {
    const md = DB.modes.find(x => x.id === m);
    const href = Render.guidePath('siemens', d, m);
    return `<li><a href="${href}">${Render.esc(d.ref)} en ${Render.esc(md.nom)}</a></li>`;
  }).join('');
  return `<div class="note info"><b>Autres modes de raccordement pour ${Render.esc(d.ref)}</b>
    <ul style="margin:8px 0 0;padding-left:18px">${items}</ul></div>`;
}

function familyHtml(DB, d) {
  const siblings = Render.familySiblings(DB, d);
  if (!siblings.length) return '';
  const items = siblings.map(s => {
    const mode = s.raccordements.iolink ? 'iolink' : Render.primaryMode(s);
    const href = Render.guidePath('siemens', s, mode);
    return `<li><a href="${href}">${Render.esc(s.marqueNom)} ${Render.esc(s.ref)}</a> — ${Render.esc(s.nom)}</li>`;
  }).join('');
  return `<div class="note"><b>Même famille</b>
    <p style="margin:0 0 8px">Même structure de données ou même bloc de commande — utile pour comparer les références de la gamme.</p>
    <ul style="margin:0;padding-left:18px">${items}</ul></div>`;
}

function blocBreadcrumbHtml(DB, bs) {
  const a = DB.automates.find(x => x.id === 'siemens');
  const seg = (txt) => `<span class="now">${Render.esc(txt)}</span>`;
  return [
    `<a href="/">Accueil</a>`,
    seg(a.nom), seg('Bloc système'), seg(bs.nom)
  ].join('<span class="sep">›</span>');
}

/* ── une page statique par fiche de bloc système, indépendante de tout appareil ── */
function buildBlocPages(db, distDir, assetV) {
  let count = 0;
  for (const bs of db.blocsSysteme) {
    const meta = Render.metaForBloc(bs);
    const articleHtml = Render.buildBlocArticle(bs);

    const html = pageTemplate({
      title: meta.title,
      description: meta.description,
      canonical: SITE_URL + meta.path,
      image: SITE_URL + '/assets/logo.png?v=' + assetV,
      breadcrumb: blocBreadcrumbHtml(db, bs),
      articleHtml,
      otherModesHtml: '',
      familyHtml: '',
      assetV
    });

    const outDir = path.join(distDir, meta.path);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    count++;
  }
  return count;
}

/* ── une page statique par appareil × mode de raccordement — et, pour un
   capteur en IO-Link, une page de plus par voie (quel maître) puisque
   chaque voie a sa propre procédure et donc sa propre page indexable ── */
function buildGuidePages(db, distDir, assetV) {
  let count = 0;
  for (const d of db.appareils) {
    for (const mode in d.raccordements) {
      const md = db.modes.find(x => x.id === mode);
      const estCapteurIolink = mode === 'iolink' && d.raccordements[mode].sens !== 'sortie' && db.voiesIolink;
      const voies = estCapteurIolink ? db.voiesIolink : [null];

      for (const voie of voies) {
        const voieId = voie ? voie.id : undefined;
        const meta = Render.metaFor(db, d, mode, voieId);
        const articleHtml = Render.buildGuideArticle(db, d, mode, voieId);
        const extraHtml = estCapteurIolink ? otherVoiesHtml(db, d, voieId) : '';

        const html = pageTemplate({
          title: meta.title,
          description: meta.description,
          canonical: SITE_URL + meta.path,
          image: d.photo ? SITE_URL + d.photo : SITE_URL + '/assets/logo.png?v=' + assetV,
          breadcrumb: breadcrumbHtml(db, d, md, voie),
          articleHtml,
          otherModesHtml: otherModesHtml(db, d, mode) + extraHtml,
          familyHtml: familyHtml(db, d),
          assetV
        });

        const outDir = path.join(distDir, meta.path);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);
        count++;
      }
    }
  }
  return count;
}

const LEGAL_PATH = '/mentions-legales/';

/* ── mentions légales, à propos, contact — une page, écrite à la main
   (contrairement au reste du site) puisqu'il n'y a pas de donnée
   structurée derrière : c'est le seul endroit qui parle DU site,
   pas d'un appareil. Passe par pageTemplate() pour garder le même
   chrome (topbar, footer, styles) que le reste. ── */
function buildLegalPage(distDir, assetV) {
  const articleHtml = `
<div class="guide-head">
  <div class="guide-head-text">
    <span class="step">IO Setup</span>
    <h1 class="title">Mentions légales, à propos et contact</h1>
    <p class="lede">Qui édite ce site, d'où vient le contenu, et comment signaler une erreur.</p>
  </div>
</div>
<section class="blk">
<h2 data-n="01">Éditeur du site</h2>
<p>Alexandre — site personnel, non professionnel.<br>
Contact : <a href="mailto:georgesalexandre25@gmail.com">georgesalexandre25@gmail.com</a></p>
</section>
<section class="blk">
<h2 data-n="02">Hébergement</h2>
<p>Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107, États-Unis.<br>
Nom de domaine enregistré chez OVH SAS — 2 rue Kellermann, 59100 Roubaix, France.</p>
</section>
<section class="blk">
<h2 data-n="03">À propos de ce site</h2>
<p>IO Setup publie des guides d'intégration pour l'IO-Link et le PROFINET, à destination des
techniciens de maintenance, automaticiens et étudiants. Chaque guide couvre le parcours complet
d'un appareil : câblage, structure des données process, intégration dans TIA Portal, code en
CONT et en SCL, et surtout les pièges de mise en service — l'information qui existe mais reste
éparpillée entre notices constructeur, portails de support et forums.</p>
<p>Le site n'est affilié à aucun des fabricants cités (KEYENCE, ifm, Siemens, et autres). Les
marques, noms de produits et logos mentionnés appartiennent à leurs propriétaires respectifs,
cités à titre de référence technique uniquement.</p>
</section>
<section class="blk">
<h2 data-n="04">Fiabilité du contenu</h2>
<p>Le contenu de chaque guide est reconstitué à partir de sources publiques et citées en bas de
page (manuels constructeur, fichiers IODD officiels, fiches techniques) — jamais de matériel,
code ou capture d'écran appartenant à un tiers ou à un employeur. Le code SCL/CONT présenté est
généré depuis cette documentation, pas testé sur une installation réelle : chaque page le
rappelle explicitement. À vérifier avant toute mise en production.</p>
<p>Une erreur, une imprécision, un brochage qui ne correspond pas à votre référence exacte ?
<a href="mailto:georgesalexandre25@gmail.com">Écrivez-moi</a> — avec la référence de l'appareil
et si possible la source qui contredit la page, la correction va plus vite.</p>
</section>
<section class="blk">
<h2 data-n="05">Données personnelles et mesure d'audience</h2>
<p>Le site ne propose ni compte utilisateur ni formulaire collectant des données personnelles.
La mesure d'audience, quand elle est active, passe par Cloudflare Web Analytics — sans cookie
ni identifiant persistant, sans profilage individuel.</p>
</section>`;

  const html = pageTemplate({
    title: 'Mentions légales, à propos et contact — IO Setup',
    description: 'Éditeur du site, hébergement, sources du contenu et contact pour signaler une erreur sur IO Setup, le site de guides d’intégration IO-Link et PROFINET.',
    canonical: SITE_URL + LEGAL_PATH,
    image: SITE_URL + '/assets/logo.png?v=' + assetV,
    breadcrumb: `<a class="now">Mentions légales</a>`,
    articleHtml,
    otherModesHtml: '',
    familyHtml: '',
    assetV,
    hideModelNote: true
  });

  const outDir = path.join(distDir, LEGAL_PATH);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

/* ── sitemap.xml : une entrée par page réelle (accueil, guides, blocs
   système), reconstruite depuis les mêmes chemins que les pages
   statiques — jamais de liste maintenue à la main, jamais désynchro. ── */
function buildSitemap(db, distDir) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: SITE_URL + '/', priority: '1.0' }];

  for (const d of db.appareils) {
    for (const mode in d.raccordements) {
      const estCapteurIolink = mode === 'iolink' && d.raccordements[mode].sens !== 'sortie' && db.voiesIolink;
      const voies = estCapteurIolink ? db.voiesIolink.map(v => v.id) : [undefined];
      for (const voieId of voies) {
        urls.push({ loc: SITE_URL + Render.guidePath('siemens', d, mode, voieId), priority: '0.8' });
      }
    }
  }
  for (const bs of db.blocsSysteme) {
    urls.push({ loc: SITE_URL + Render.blocSystemePath(bs), priority: '0.6' });
  }
  urls.push({ loc: SITE_URL + LEGAL_PATH, priority: '0.2' });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
  return urls.length;
}

function buildRobots(distDir) {
  fs.writeFileSync(path.join(distDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

function build() {
  const db = buildDB();
  const distDir = path.join(ROOT, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(distDir, 'styles.css'));
  fs.copyFileSync(path.join(__dirname, 'render.js'), path.join(distDir, 'render.js'));

  const assetsDir = path.join(__dirname, 'assets');
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(assetsDir, 'logo.png'), path.join(distDir, 'assets', 'logo.png'));
  fs.copyFileSync(path.join(assetsDir, 'demo.mp4'), path.join(distDir, 'assets', 'demo.mp4'));
  for (const f of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
    fs.copyFileSync(path.join(assetsDir, f), path.join(distDir, f));
  }
  if (fs.existsSync(APPAREILS_ASSETS_DIR)) {
    fs.mkdirSync(path.join(distDir, 'assets', 'appareils'), { recursive: true });
    for (const f of fs.readdirSync(APPAREILS_ASSETS_DIR)) {
      fs.copyFileSync(path.join(APPAREILS_ASSETS_DIR, f), path.join(distDir, 'assets', 'appareils', f));
    }
  }
  const assetV = computeAssetVersion(assetsDir);

  buildMaquette(db, distDir, assetV);
  const pageCount = buildGuidePages(db, distDir, assetV);
  const blocPageCount = buildBlocPages(db, distDir, assetV);
  buildLegalPage(distDir, assetV);
  const urlCount = buildSitemap(db, distDir);
  buildRobots(distDir);

  console.log(`OK — ${db.appareils.length} appareils, ${Object.keys(db.procedures).length} procédures, ${Object.keys(db.famillesIodd).length} famille(s) IODD, ${Object.keys(db.famillesCommande).length} famille(s) de commande, ${db.blocsSysteme.length} blocs système`);
  console.log(`→ dist/index.html (maquette interactive)`);
  console.log(`→ ${pageCount} pages statiques générées (appareils)`);
  console.log(`→ ${blocPageCount} pages statiques générées (blocs système)`);
  console.log(`→ dist/sitemap.xml (${urlCount} URLs), dist/robots.txt`);
}

build();
