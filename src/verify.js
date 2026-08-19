/* ── Étape 5 du CLAUDE.md : vérification hors navigateur de toutes les
   pages générées. Reconstruit dist/ à neuf (un crash de build.js est déjà
   en soi un échec, remonté tel quel) puis relit chaque page statique pour
   détecter ce qu'un crash de build ne détecte PAS : une valeur manquante
   qui s'est rendue en "undefined"/"NaN" plutôt que de planter, un lien
   interne qui pointe vers une page qui n'existe pas, une balise SEO vide
   ou absente, un <h1> manquant. Pensé pour tourner en ligne de commande
   avant un push, pas pour être exhaustif sur tout ce qu'un navigateur
   vérifierait (CSS, JS runtime de la maquette interactive) — ça reste
   hors du périmètre de ce script, volontairement. ── */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://iosetup.com';

console.log('Reconstruction de dist/ ...');
try {
  execSync('node src/build.js', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  console.error('❌ build.js a planté — c\'est en soi la première chose que ce script devait attraper :\n');
  console.error(e.stdout ? e.stdout.toString() : '');
  console.error(e.stderr ? e.stderr.toString() : e.message);
  process.exit(1);
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
}
const allFiles = [];
walk(DIST, allFiles);
const allFilesSet = new Set(allFiles);
const htmlFiles = allFiles.filter(p => p.endsWith('.html'));

/* ── un chemin de dist/ correspondant à une URL "dossier" (/a/b/) doit
   exister comme dossier/index.html ; une URL "fichier" (/sitemap.xml,
   /assets/x.png) doit exister telle quelle. ── */
function targetExists(urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return allFilesSet.has(path.join(DIST, 'index.html'));
  const rel = clean.replace(/^\//, '');
  if (clean.endsWith('/')) return allFilesSet.has(path.join(DIST, rel, 'index.html'));
  return allFilesSet.has(path.join(DIST, rel));
}

const report = []; // { file, issues: [] }

for (const file of htmlFiles) {
  const raw = fs.readFileSync(file, 'utf-8');
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  const issues = [];

  /* le contenu à l'intérieur des <script> est du JS, pas du rendu —
     "undefined"/"NaN" y sont des mots normaux du langage, pas un bug.
     Idem pour l'extraction des liens : les gabarits JS de la maquette
     interactive contiennent des `href="${...}"` qui ne sont pas de
     vrais attributs DOM. On retire les <script> avant les deux passes. */
  const noScript = raw.replace(/<script[\s\S]*?<\/script>/gi, '');

  const badWords = noScript.match(/\bundefined\b|\bNaN\b/g);
  if (badWords) issues.push(`${badWords.length} occurrence(s) de undefined/NaN dans le rendu (hors <script>) : ${[...new Set(badWords)].join(', ')}`);

  const titleM = raw.match(/<title>([^<]*)<\/title>/);
  if (!titleM || !titleM[1].trim()) issues.push('<title> manquant ou vide');

  const descM = raw.match(/<meta name="description" content="([^"]*)"/);
  if (!descM || !descM[1].trim()) issues.push('<meta name="description"> manquante ou vide');

  const canonM = raw.match(/<link rel="canonical" href="([^"]*)"/);
  if (!canonM || !canonM[1].trim()) issues.push('<link rel="canonical"> manquant ou vide');

  const h1M = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1M || !h1M[1].replace(/<[^>]+>/g, '').trim()) issues.push('<h1> manquant ou vide');

  const linkRe = /(?:href|src)="([^"]*)"/g;
  const brokenLinks = new Set();
  let m;
  while ((m = linkRe.exec(noScript))) {
    let url = m[1];
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) continue;
    if (url.startsWith(SITE_URL)) url = url.slice(SITE_URL.length) || '/';
    else if (/^https?:\/\//.test(url)) continue; // domaine externe, hors périmètre
    if (!targetExists(url)) brokenLinks.add(url);
  }
  if (brokenLinks.size) issues.push(`lien(s) interne(s) cassé(s) : ${[...brokenLinks].join(', ')}`);

  if (issues.length) report.push({ file: rel, issues, title: titleM ? titleM[1].trim() : null });
}

/* ── bonus : deux pages différentes avec exactement le même <title>
   trahissent presque toujours un copier-coller pas terminé (déjà
   arrivé une fois sur ce site — la fiche 15 segments gardait le texte
   de la 9 segments). Les pages "autre voie de maître" (.../s7pct/) sont
   volontairement exclues : elles partagent le titre de leur page par
   défaut par construction, ce n'est pas un bug. ── */
const titlesSeen = new Map();
for (const file of htmlFiles) {
  if (file.includes(`${path.sep}s7pct${path.sep}`)) continue;
  const raw = fs.readFileSync(file, 'utf-8');
  const titleM = raw.match(/<title>([^<]*)<\/title>/);
  if (!titleM) continue;
  const t = titleM[1].trim();
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  if (!titlesSeen.has(t)) titlesSeen.set(t, []);
  titlesSeen.get(t).push(rel);
}
for (const [t, files] of titlesSeen) {
  if (files.length > 1) {
    report.push({ file: files.join(' & '), issues: [`<title> identique sur ${files.length} pages : « ${t} »`], title: t });
  }
}

console.log(`\n${htmlFiles.length} pages HTML générées, vérifiées.\n`);
if (!report.length) {
  console.log('✅ Aucun problème détecté.');
  process.exit(0);
}
console.log(`❌ ${report.length} problème(s) détecté(s) :\n`);
for (const r of report) {
  console.log(`— ${r.file}`);
  for (const i of r.issues) console.log(`    ${i}`);
}
process.exit(1);
