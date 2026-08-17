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
  for (const f of ['logo.png', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
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

function buildDB() {
  const taxonomie = readJson(path.join(DATA, 'taxonomie.json'));
  const procedures = readDir(path.join(DATA, 'procedures'));
  const famillesIodd = readDir(path.join(DATA, 'familles'));
  const famillesCommande = readDir(path.join(DATA, 'familles-commande'));
  const appareilsDir = path.join(DATA, 'appareils');
  const appareils = fs.readdirSync(appareilsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(appareilsDir, f)));
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
function pageTemplate({ title, description, canonical, breadcrumb, articleHtml, otherModesHtml, familyHtml, assetV }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico?v=${assetV}" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=${assetV}">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=${assetV}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${assetV}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${assetV}">
</head>
<body>

<header>
  <div class="wrap hbar">
    <a class="logo" href="/" style="text-decoration:none"><img src="/assets/logo.png?v=${assetV}" alt="IO Setup"></a>
  </div>
</header>

<nav class="crumbs"><div class="wrap">${breadcrumb}</div></nav>
<main class="wrap">
<a class="back" href="/" style="display:inline-block">← Tous les guides</a>
${articleHtml}
${otherModesHtml}
${familyHtml}
<div class="model-note"><b>À propos de cette page</b>
  Cette page est générée depuis des fiches de données structurées, pas écrite à la main —
  voir <a href="/" style="color:inherit">la maquette interactive</a> pour naviguer parmi tous les guides.</div>
</main>

<script>
function showLang(id,btn){
  document.querySelectorAll('.lang').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('lang-'+id).classList.add('on');btn.classList.add('on');
}
</script>
</body>
</html>`;
}

function breadcrumbHtml(DB, d, md) {
  const a = DB.automates.find(x => x.id === 'siemens');
  const c = DB.categories.find(x => x.id === d.categorie);
  const t = DB.sousTypes[d.categorie].find(x => x.id === d.type);
  const m = DB.marques.find(x => x.id === d.marque);
  const seg = (txt) => `<span class="now">${Render.esc(txt)}</span>`;
  return [
    `<a href="/">Accueil</a>`,
    seg(a.nom), seg(c.nom), seg(t.nom), seg(m.nom), seg(d.ref), seg(md.nom)
  ].join('<span class="sep">›</span>');
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

/* ── une page statique par appareil × mode de raccordement ── */
function buildGuidePages(db, distDir, assetV) {
  let count = 0;
  for (const d of db.appareils) {
    for (const mode in d.raccordements) {
      const md = db.modes.find(x => x.id === mode);
      const meta = Render.metaFor(db, d, mode);
      const articleHtml = Render.buildGuideArticle(db, d, mode);

      const html = pageTemplate({
        title: meta.title,
        description: meta.description,
        canonical: SITE_URL + meta.path,
        breadcrumb: breadcrumbHtml(db, d, md),
        articleHtml,
        otherModesHtml: otherModesHtml(db, d, mode),
        familyHtml: familyHtml(db, d),
        assetV
      });

      const outDir = path.join(distDir, meta.path);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), html);
      count++;
    }
  }
  return count;
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
  for (const f of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
    fs.copyFileSync(path.join(assetsDir, f), path.join(distDir, f));
  }
  const assetV = computeAssetVersion(assetsDir);

  buildMaquette(db, distDir, assetV);
  const pageCount = buildGuidePages(db, distDir, assetV);
  const blocPageCount = buildBlocPages(db, distDir, assetV);

  console.log(`OK — ${db.appareils.length} appareils, ${Object.keys(db.procedures).length} procédures, ${Object.keys(db.famillesIodd).length} famille(s) IODD, ${Object.keys(db.famillesCommande).length} famille(s) de commande, ${db.blocsSysteme.length} blocs système`);
  console.log(`→ dist/index.html (maquette interactive)`);
  console.log(`→ ${pageCount} pages statiques générées (appareils)`);
  console.log(`→ ${blocPageCount} pages statiques générées (blocs système)`);
}

build();
