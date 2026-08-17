/* ══════════════════════════════════════════════════════════
   RENDER — logique de construction des guides, partagée entre
   la maquette interactive (navigateur) et le générateur de
   pages statiques (Node, src/build.js).
   Aucune fonction ici ne touche au DOM : tout renvoie des
   chaînes de caractères.
   ══════════════════════════════════════════════════════════ */
(function (root) {
'use strict';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Fusionne la famille IODD dans le raccordement de l'appareil.
   C'est ce qui permet d'ajouter un capteur de la même gamme
   en quelques lignes de données, sans dupliquer la trame. */
function rac(DB, d, mode) {
  const r = d.raccordements[mode];
  if (!r || !r.familleIodd) return r;
  const F = DB.famillesIodd[r.familleIodd], v = r.variante || {};
  const sub = t => String(t).replace('@VAL2@', v.val2 || '—').replace('@BIT28@', v.bit28 || '—');
  return Object.assign({}, r, {
    famille: F.nom,
    trame: F.trame,
    donnees: F.donnees.map(x => Object.assign({}, x, { nom: sub(x.nom) })),
    bitsDiag: F.bitsDiag.map(b => [b[0], b[1], sub(b[2])]),
    avertissementIodd: F.avertissementIodd,
    sansGradient: F.sansGradient
  });
}

/* ── connecteur dessiné selon le nombre de broches ── */
function connSvg(r) {
  if (/RJ45/.test(r.connecteur)) {
    const c = {}; r.pinout.forEach(p => c[p.n] = p.hex);
    let s = `<svg viewBox="0 0 160 90" aria-label="Brochage RJ45"><rect x="10" y="15" width="140" height="55" rx="4" fill="none" stroke="#141A20" stroke-width="2.5"/>`;
    for (let i = 0; i < 8; i++) {
      const x = 24 + i * 16;
      s += `<rect x="${x - 5}" y="24" width="10" height="26" fill="${c[i + 1] || '#EDEEEA'}" stroke="#141A20" stroke-width="1.2"/>`;
      s += `<text x="${x}" y="63" text-anchor="middle" font-family="IBM Plex Mono" font-size="9">${i + 1}</text>`;
    }
    return s + '</svg>';
  }
  const huit = /8/.test(r.connecteur);
  if (!huit) {
    const c = {}; r.pinout.forEach(p => c[p.n] = p.hex);
    return `<svg viewBox="0 0 120 120" aria-label="Brochage M12 4 broches"><circle cx="60" cy="60" r="44" fill="none" stroke="#141A20" stroke-width="2.5"/>
    <circle cx="60" cy="38" r="7" fill="${c[1] || '#fff'}" stroke="#141A20" stroke-width="1.5"/>
    <circle cx="38" cy="60" r="7" fill="${c[2] || '#fff'}" stroke="#141A20" stroke-width="1.5"/>
    <circle cx="82" cy="60" r="7" fill="${c[4] || '#fff'}" stroke="#141A20" stroke-width="1.5"/>
    <circle cx="60" cy="82" r="7" fill="${c[3] || '#fff'}" stroke="#141A20" stroke-width="1.5"/>
    <text x="60" y="20" text-anchor="middle" font-family="IBM Plex Mono" font-size="12">1</text>
    <text x="20" y="64" text-anchor="middle" font-family="IBM Plex Mono" font-size="12">2</text>
    <text x="100" y="64" text-anchor="middle" font-family="IBM Plex Mono" font-size="12">4</text>
    <text x="60" y="110" text-anchor="middle" font-family="IBM Plex Mono" font-size="12">3</text></svg>`;
  }
  const c = {}; r.pinout.forEach(p => c[p.n] = p.hex);
  const pos = [[60, 32], [38, 44], [38, 70], [60, 84], [82, 70], [82, 44], [60, 58], [46, 58]];
  const lbl = [[60, 16], [22, 44], [22, 76], [60, 104], [100, 76], [100, 44], [74, 58], [32, 58]];
  let s = `<svg viewBox="0 0 120 120" aria-label="Brochage M12 8 broches"><circle cx="60" cy="60" r="46" fill="none" stroke="#141A20" stroke-width="2.5"/>`;
  for (let i = 0; i < 8; i++) {
    s += `<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="6" fill="${c[i + 1] || '#EDEEEA'}" stroke="#141A20" stroke-width="1.4"/>`;
    s += `<text x="${lbl[i][0]}" y="${lbl[i][1] + 4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10">${i + 1}</text>`;
  }
  return s + '</svg>';
}

/* ── bloc données process IO-Link ── */
function blocIolink(r, num) {
  const N = r.trame.octets, cols = `grid-template-columns:repeat(${N},1fr)`;
  const cells = Array.from({ length: N }, () => null);
  r.donnees.forEach(x => x.octets.forEach((o, i) => {
    cells[o] = { coul: x.couleur, txt: x.octets.length > 1 ? `${x.nom}<br>${i === 0 ? 'MSB' : (i === x.octets.length - 1 ? 'LSB' : '·')}` : x.nom };
  }));
  const strip = cells.map(c => c
    ? `<div class="byte" style="background:${c.coul};color:#fff">${c.txt}</div>`
    : `<div class="byte nil">—</div>`).join('');

  let h = `<section class="blk"><h2 data-n="${num()}">Structure des données process</h2>`;
  if (r.iodd) {
    h += `<table style="margin-bottom:18px"><tbody>
      <tr><th style="width:33%">Fichier IODD</th><td class="mono">${esc(r.iodd.fichier)}</td></tr>
      <tr><th>Version · date</th><td>${esc(r.iodd.version)} — ${esc(r.iodd.date)}</td></tr>
      <tr><th>VendorID · DeviceID</th><td class="mono">${esc(r.iodd.vendorId)} · ${esc(r.iodd.deviceId)}</td></tr>
      <tr><th>Variantes couvertes</th><td>${esc(r.iodd.variantes)}</td></tr>
      ${r.famille ? `<tr><th>Famille IODD</th><td>${esc(r.famille)} — structure de données process commune à toute la gamme</td></tr>` : ''}
      <tr><th>Data Storage</th><td>${r.iodd.dataStorage
        ? '✅ Pris en charge — le maître sauvegarde le paramétrage. Un capteur remplacé est reconfiguré automatiquement.'
        : 'Non pris en charge'}</td></tr>
      </tbody></table>`;
  }
  if (r.avertissementIodd)
    h += `<div class="note warn"><b>${esc(r.avertissementIodd.t)}</b>${esc(r.avertissementIodd.d)}</div>`;

  h += `<div class="frame-caption" style="margin-top:18px">${r.trame.bits} bits — ${N} octets${
      cells.includes(null) ? ' — les zones hachurées ne sont pas utilisées' : ''}</div>
   <div class="bytes" style="${cols}">${strip}</div>
   <div class="ruler" style="${cols}">${Array.from({ length: N }, (_, i) => `<div class="tick">${i}</div>`).join('')}</div>
   <div class="legend">${r.donnees.map(x =>
     `<span><i style="background:${x.couleur}"></i>${esc(x.nom)} — octet${x.octets.length > 1 ? 's' : ''} ${
      x.octets.length > 1 ? x.octets[0] + '-' + x.octets[x.octets.length - 1] : x.octets[0]}</span>`).join('')}
     ${cells.includes(null) ? '<span><i style="background:var(--card-2);border:1px solid var(--line)"></i>Inutilisé</span>' : ''}</div>

   <table style="margin-top:20px"><thead><tr><th>Donnée</th><th>Offset bit</th><th>Longueur</th><th>Type</th><th>Plage brute</th><th>Conversion</th></tr></thead>
   <tbody>${r.donnees.map(x => `<tr><td>${esc(x.nom)}</td><td class="num">${x.bitOffset}</td>
     <td class="num">${x.bits} bits</td><td class="num">${esc(x.type)}</td>
     <td class="num">${x.min !== undefined ? x.min + ' … ' + x.max : '—'}</td>
     <td class="num">${x.gradient ? '÷ 10 → ' + x.unite : (x.unite ? esc(x.unite) : 'bits d’état')}</td></tr>`).join('')}</tbody></table>`;

  if (r.sansGradient)
    h += `<div class="note warn"><b>${esc(r.sansGradient.t)}</b>${esc(r.sansGradient.d)}</div>`;
  else
    h += `<div class="note info"><b>Exemple de lecture</b>Valeur brute 435 sur les octets 0-1 → <span class="m">43,5 % RH</span>. Valeur brute −85 sur les octets 4-5 → <span class="m">−8,5 °C</span>.</div>`;

  if (r.bitsDiag) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Bits de diagnostic</h2>
     <p style="margin:0 0 12px;color:var(--ink-2);font-size:13.5px">
     Tout ce que le capteur affiche à l’écran remonte en cyclique. Aucune lecture acyclique n’est
     nécessaire pour construire une supervision complète.</p>
     <table><thead><tr><th style="width:70px">Octet</th><th style="width:90px">Bit</th><th>Signification</th></tr></thead>
     <tbody>${r.bitsDiag.map(b => `<tr><td class="num">${b[0]}</td><td class="num">${b[1]}</td><td>${esc(b[2])}</td></tr>`).join('')}</tbody></table>`;
  }
  if (r.valeursSpeciales) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Valeurs spéciales à filtrer</h2>
     <table><thead><tr><th>Valeur brute</th><th>Signification</th><th>Concerne</th></tr></thead>
     <tbody>${r.valeursSpeciales.map(v => `<tr><td class="num">${v[0]}</td><td>${esc(v[1])}</td><td>${esc(v[2])}</td></tr>`).join('')}</tbody></table>`;
  }
  if (r.deviceStatus) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Device status</h2>
     <table><tbody>${r.deviceStatus.map(v => `<tr><th style="width:90px" class="num">${v[0]}</th><td>${esc(v[1])}</td></tr>`).join('')}</tbody></table>
     <div class="note info"><b>Maintenance conditionnelle</b>Copie du paramètre index 36 dans le canal cyclique : exploitable sans lecture acyclique.</div>`;
  }
  return h + '</section>';
}

/* ── bloc commande : appareils dont les données process sont en SORTIE ── */
function blocCommande(r, num) {
  const C = r.commande;
  let h = `<section class="blk"><h2 data-n="${num()}">Piloter l’appareil</h2>
   <div class="note info"><b>Sens des données : sortie</b>
     Contrairement à un capteur, l’automate <strong>écrit</strong> vers cet appareil.
     Il n’y a pas de trame d’octets à décoder : Siemens fournit un bloc fonction qui
     encapsule la communication IO-Link.</div>
   <table style="margin-top:16px"><tbody>
     <tr><th style="width:33%">Bloc fonction</th><td class="mono">${esc(C.bloc)}</td></tr>
     <tr><th>Où le trouver</th><td>${esc(C.blocNote)}</td></tr>
   </tbody></table>
   <h2 data-n="${num()}" style="margin-top:26px">Interface du bloc</h2>
   <table><thead><tr><th style="width:26%">Entrée</th><th style="width:22%">Type</th><th>Rôle</th></tr></thead>
   <tbody>${C.entrees.map(e => `<tr><td class="mono">${esc(e[0])}</td><td class="mono">${esc(e[1])}</td><td>${esc(e[2])}</td></tr>`).join('')}</tbody></table>
   <table style="margin-top:12px"><thead><tr><th style="width:26%">Sortie</th><th style="width:22%"></th><th>Rôle</th></tr></thead>
   <tbody>${C.sorties.map(e => `<tr><td class="mono">${esc(e[0])}</td><td class="mono">${esc(e[1])}</td><td>${esc(e[2])}</td></tr>`).join('')}</tbody></table>
   <h2 data-n="${num()}" style="margin-top:26px">Valeurs à envoyer</h2>
   <p style="margin:0 0 12px;color:var(--ink-2);font-size:13.5px">
     Pour chacun des cinq segments, un DInt de couleur et un DInt d’effet.</p>
   <div class="pins">
   <table style="min-width:230px"><thead><tr><th>Couleur</th><th>Signification</th></tr></thead>
   <tbody>${C.couleurs.map(v => `<tr><td class="num">${v[0]}</td><td>${esc(v[1])}</td></tr>`).join('')}</tbody></table>
   <table style="min-width:230px"><thead><tr><th>Effet</th><th>Signification</th></tr></thead>
   <tbody>${C.effets.map(v => `<tr><td class="num">${v[0]}</td><td>${esc(v[1])}</td></tr>`).join('')}</tbody></table>
   </div>
   <div class="note warn"><b>Cinq segments maximum en mode Autoscale</b>
     Les segments 1 à 5 se règlent par <span class="mono">colorSegmentN</span> et
     <span class="mono">effectSegmentN</span>. Mettre l’effet à 0 éteint le segment.
     Pour utiliser moins de couleurs, on ne renseigne que les premiers segments et on laisse
     les autres à 0.</div>
   </section>`;
  return h;
}

/* ── bloc analogique ── */
function blocAnalog(r, num) {
  const A = r.analog;
  return `<section class="blk"><h2 data-n="${num()}">La boucle de courant</h2>
   <table><tbody>
    <tr><th style="width:33%">Plage</th><td>${esc(A.plage)}</td></tr>
    <tr><th>Résistance de charge</th><td>${esc(A.charge)}</td></tr>
    <tr><th>Résolution</th><td>${esc(A.resolution)}</td></tr>
    <tr><th>Précision au zéro</th><td>${esc(A.precisionZero)}</td></tr>
    <tr><th>Précision pleine échelle</th><td>${esc(A.precisionPE)}</td></tr>
    <tr><th>Temps de réponse</th><td>${esc(A.tempsReponse)}</td></tr>
   </tbody></table>
   <h2 data-n="${num()}" style="margin-top:26px">Correspondance niveau → courant</h2>
   <p style="margin:0 0 12px;color:var(--ink-2);font-size:13.5px">Exemple pour un réservoir de 1000 mm, capteur installé 100 mm au-dessus du bord haut.</p>
   <table><thead><tr><th>Situation</th><th>Niveau</th><th>Sortie</th></tr></thead>
   <tbody>${A.exemple.map(e => `<tr><td>${esc(e[0])}</td><td class="num">${e[1]}</td><td class="num">${e[2]}</td></tr>`).join('')}</tbody></table>
   <div class="note warn"><b>Hors plage et perte de détection</b>${esc(A.hors)}</div>
   <div class="note info"><b>Pas d’IODD, pas de GSDML, pas de maître</b>
     En analogique, toute la chaîne IO-Link disparaît. Le capteur devient une simple source de courant :
     c’est plus simple à mettre en œuvre, mais on perd le diagnostic, le paramétrage à distance et la valeur d’état.</div>
   </section>`;
}

/* ── bloc TOR ── */
function blocTor(r, num) {
  const T = r.tor;
  return `<section class="blk"><h2 data-n="${num()}">Les sorties de commutation</h2>
   <table><tbody>
    <tr><th style="width:33%">Type</th><td>${esc(T.type)}</td></tr>
    <tr><th>Limites électriques</th><td>${esc(T.limites)}</td></tr>
    <tr><th>Logique</th><td>${esc(T.logique)}</td></tr>
   </tbody></table>
   <h2 data-n="${num()}" style="margin-top:26px">Modes de sortie disponibles</h2>
   <table><tbody>${T.modes.map(m => `<tr><th style="width:27%">${esc(m[0])}</th><td>${esc(m[1])}</td></tr>`).join('')}</tbody></table>
   <div class="note warn"><b>Tout se règle sur le capteur</b>
     Les seuils, l’hystérésis et la logique N.O./N.F. se saisissent sur l’afficheur du capteur, pas dans TIA Portal.
     Côté automate, vous ne lisez que des bits. Aucune conversion, aucun bloc de calcul — mais aucune traçabilité
     du paramétrage dans le projet non plus.</div>
   </section>`;
}

/* ── bloc données process PROFINET natif (télégramme PROFIdrive) ──
   Contrairement à l'IODD, un GSDML ne décrit ses données que par mot
   PZD, pas par bit — la structure est donc une table, pas une bande
   d'octets. Le détail bit à bit de STW1/ZSW1 relève du profil
   PROFIdrive, un standard séparé du GSD de cet appareil : signalé
   explicitement plutôt que présenté comme vérifié depuis le GSD. */
function blocProfinet(r, num) {
  let h = `<section class="blk"><h2 data-n="${num()}">Structure des données process</h2>`;
  if (r.gsdml) {
    h += `<table style="margin-bottom:18px"><tbody>
      <tr><th style="width:33%">Fichier GSDML</th><td class="mono">${esc(r.gsdml.fichier)}</td></tr>
      <tr><th>Version · date</th><td>${esc(r.gsdml.version)} — ${esc(r.gsdml.date)}</td></tr>
      <tr><th>VendorID · DeviceID</th><td class="mono">${esc(r.gsdml.vendorId)} · ${esc(r.gsdml.deviceId)}</td></tr>
      <tr><th>Variantes couvertes</th><td>${esc(r.gsdml.variantes)}</td></tr>
      </tbody></table>`;
  }
  if (r.telegrammes) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Télégrammes disponibles</h2>
     <p style="margin:0 0 12px;color:var(--ink-2);font-size:13.5px">Le choix du télégramme se fait dans les propriétés de l’appareil sous TIA Portal — rien à coder, c’est déclaratif. Celui documenté ci-dessous est indiqué en premier.</p>
     <table><thead><tr><th>Télégramme</th><th>Mots PZD (in/out)</th><th>Description</th></tr></thead>
     <tbody>${r.telegrammes.map(t => `<tr><td${t.id === r.telegrammeDocumente ? ' style="color:var(--signal-deep);font-weight:600"' : ''}>${esc(t.id)}${t.id === r.telegrammeDocumente ? ' ←' : ''}</td><td class="num">${esc(t.pzd)}</td><td>${esc(t.desc)}</td></tr>`).join('')}</tbody></table>`;
  }
  if (r.donnees) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Mots PZD du télégramme documenté</h2>
     <table><thead><tr><th>Mot</th><th>Sens</th><th>Nom</th><th>Type</th><th>Unité / échelle</th></tr></thead>
     <tbody>${r.donnees.map(x => `<tr><td class="num">PZD${x.pzd}</td>
       <td>${x.sens === 'sortie' ? '→ Écriture (CPU → variateur)' : '← Lecture (variateur → CPU)'}</td>
       <td>${esc(x.nom)}</td><td class="num">${esc(x.type)}</td>
       <td>${x.unite ? esc(x.unite) : '—'}</td></tr>`).join('')}</tbody></table>
     <div class="note warn"><b>Le détail bit à bit n’est pas dans le GSD</b>
       Le GSDML nomme chaque mot (« mot de commande ou consigne », « mot d’état ou mesure ») mais ne détaille pas
       la signification de chaque bit — celle-ci vient du profil PROFIdrive, un standard séparé de ce document.
       Les bits les plus universellement documentés — STW1 bit 0 (Marche/Arrêt1), ZSW1 bits 0 à 3 (prêt à
       l’enclenchement, prêt, fonctionnement activé, défaut) — sont repris ci-dessous en code ; pour le reste,
       se reporter à la liste des paramètres du variateur ou au profil PROFIdrive.</div>`;
  }
  if (r.diagnostics) {
    h += `<h2 data-n="${num()}" style="margin-top:28px">Diagnostics PROFIdrive</h2>
     <p style="margin:0 0 12px;color:var(--ink-2);font-size:13.5px">Codes de diagnostic génériques, remontés en cyclique sans lecture acyclique nécessaire.</p>
     <table><thead><tr><th style="width:34%">Diagnostic</th><th>Cause et action</th></tr></thead>
     <tbody>${r.diagnostics.map(x => `<tr><th>${esc(x.nom)}</th><td>${esc(x.aide)}</td></tr>`).join('')}</tbody></table>`;
  }
  return h + '</section>';
}

/* ── bloc programmation à onglets ── */
function blocProg(scl, lad, num) {
  return `<section class="blk"><h2 data-n="${num()}">Programmation</h2>
   <div class="tabs" role="tablist">
     <button class="tab on" onclick="showLang('cont',this)">CONT — Ladder</button>
     <button class="tab" onclick="showLang('scl',this)">SCL</button>
     <button class="tab" disabled>LOG</button><button class="tab" disabled>LIST</button>
   </div>
   <div class="lang on" id="lang-cont"><pre class="lad">${lad}</pre></div>
   <div class="lang" id="lang-scl"><pre>${scl}</pre></div>
   <div class="note info"><b>CONT ou SCL ?</b>La mise à l’échelle est plus lisible en SCL.
     L’usage courant est d’écrire ce bloc en SCL et de l’appeler depuis le programme CONT.
     La version CONT existe pour les sites où le SCL n’est pas autorisé.</div>
   <div class="note warn"><b>Code non validé sur installation</b>Généré depuis la documentation. À confirmer sur matériel avant mise en production.</div>
   </section>`;
}

/* ── générateurs de code ── */
function codeSclIolink(d, r) {
  const spec = r.valeursSpeciales.filter(v => /Température|et/.test(v[2])).map(v => v[0].replace('−', '-')).join(', ');
  return `<span class="c">// Données process ${d.ref} — ${r.trame.octets} octets
// Octets 0-1 : humidité (INT, ×0,1 %RH) · 4-5 : température (INT, ×0,1 °C) · 7 : status</span>

<span class="k">FUNCTION_BLOCK</span> <span class="n">"FB_${d.ref}"</span>
<span class="k">VAR_INPUT</span>
    humRaw : INT; tempRaw : INT; statusRaw : BYTE;
<span class="k">END_VAR</span>
<span class="k">VAR_OUTPUT</span>
    humidite : REAL; temperature : REAL;
    humValide : BOOL; tempValide : BOOL;
    deviceStatus : USINT; maintenance : BOOL; defaillance : BOOL;
<span class="k">END_VAR</span>

<span class="k">BEGIN</span>
    <span class="k">IF</span> #humRaw = 32764 <span class="k">THEN</span>   <span class="c">// NoData</span>
        #humValide := FALSE; #humidite := 0.0;
    <span class="k">ELSE</span>
        #humValide := TRUE;  #humidite := INT_TO_REAL(#humRaw) / 10.0;
    <span class="k">END_IF</span>;

    <span class="k">CASE</span> #tempRaw <span class="k">OF</span>
        ${spec}:
            #tempValide := FALSE; #temperature := 0.0;
        <span class="k">ELSE</span>
            #tempValide := TRUE;  #temperature := INT_TO_REAL(#tempRaw) / 10.0;
    <span class="k">END_CASE</span>;

    #deviceStatus := BYTE_TO_USINT(SHR(IN := #statusRaw, N := 4)) <span class="k">AND</span> 16#0F;
    #maintenance  := (#deviceStatus &gt;= 1);
    #defaillance  := (#deviceStatus = 4);
<span class="k">END_FUNCTION_BLOCK</span>

<span class="c">// Valeurs aberrantes ? Inversion d'octets Siemens :
// humRaw := WORD_TO_INT(SWAP(INT_TO_WORD(humRaw)));</span>`;
}
function codeLadIolink(d, r) {
  const spec = r.valeursSpeciales.filter(v => /Température|et/.test(v[2])).map(v => v[0].replace('−', '-'));
  const cmp = (v, i) => `      ┌─────────────┐
      │     <>      │
${i === 0 ? '──────' : '      '}┤     Int     ├${i === spec.length - 1 ? '──────────( tempValide )' : '──────'}
      │ IN1  tempRaw│
      │ IN2 ${String(v).padStart(7)} │
      └─────────────┘`;
  return `<span class="c">// Adresses à adapter à la plage attribuée à votre port.</span>

<span class="r">Réseau 1 — Humidité : donnée valide ?</span>
      ┌─────────────┐
      │     <>      │
──────┤     Int     ├──────────( humValide )
      │ IN1   humRaw│
      │ IN2    32764│  <span class="c">← NoData</span>
      └─────────────┘

<span class="r">Réseau 2 — Conversion humidité (÷ 10 → % RH)</span>
                ┌──────────┐    ┌──────────┐
   humValide    │   CONV   │    │   DIV    │
──────┤ ├───────┤ Int→Real ├────┤   Real   ├──( humidite )
                │IN  humRaw│    │IN2   10.0│
                └──────────┘    └──────────┘

<span class="r">Réseau 3 — Température : donnée valide ?</span>
<span class="c">   Les ${spec.length} valeurs spéciales sont testées en série : toutes doivent être fausses.</span>
${spec.map(cmp).join('\n')}

<span class="r">Réseau 4 — Conversion température (÷ 10 → °C)</span>
                ┌──────────┐    ┌──────────┐
   tempValide   │   CONV   │    │   DIV    │
──────┤ ├───────┤ Int→Real ├────┤   Real   ├──( temperature )
                │IN tempRaw│    │IN2   10.0│
                └──────────┘    └──────────┘

<span class="r">Réseau 5 — Device status : 4 bits de poids fort</span>
      ┌──────────────┐    ┌──────────────┐
      │     SHR      │    │     AND      │
──────┤     Byte     ├────┤     Byte     ├──( deviceStatus )
      │IN  statusRaw │    │IN2    16#0F  │
      │N          4  │    └──────────────┘
      └──────────────┘`;
}
function codeSclFRS(d, r) {
  const v2 = (r.variante && r.variante.val2) || 'seconde valeur';
  return `<span class="c">// ${d.ref} en IO-Link — 12 octets de données process
// 0-3 : valeur actuelle (INT 32)      4-7  : ${v2.toLowerCase()} (INT 32)
// 8   : diagnostics                   9    : erreurs
// 10  : stabilité + couleur           11   : état des sorties</span>

<span class="k">FUNCTION_BLOCK</span> <span class="n">"FB_FR_S01"</span>
<span class="k">VAR_INPUT</span>
    valeurBrute : DINT;   <span class="c">// octets 0-3</span>
    valeur2Brute: DINT;   <span class="c">// octets 4-7 — ${v2}</span>
    diag        : BYTE;   <span class="c">// octet 8</span>
    erreurs     : BYTE;   <span class="c">// octet 9</span>
    etat        : BYTE;   <span class="c">// octet 10</span>
    sorties     : BYTE;   <span class="c">// octet 11</span>
    decimales   : USINT := 0;  <span class="c">// ⚠ doit refléter le réglage FAIT SUR LE CAPTEUR</span>
<span class="k">END_VAR</span>
<span class="k">VAR_OUTPUT</span>
    niveau      : REAL;   <span class="c">// dans l'unité réglée sur l'appareil</span>
    mesureOK    : BOOL;
    niveauHaut  : BOOL;   <span class="c">// HIGH</span>
    niveauBas   : BOOL;   <span class="c">// LOW</span>
    stabilite   : USINT;  <span class="c">// 0 = perdu … 4 = signal franc</span>
    maintenance : BOOL;   <span class="c">// stabilité dégradée</span>
    interference: BOOL;   <span class="c">// autre source 60 GHz</span>
    defaut      : BOOL;   <span class="c">// erreur système / EEPROM / tête</span>
<span class="k">END_VAR</span>

<span class="k">BEGIN</span>
    <span class="c">// ---- Octet 8 : diagnostics ----</span>
    #niveauBas    := #diag.%X7;   <span class="c">// bit 31 — LOW</span>
    #niveauHaut   := #diag.%X6;   <span class="c">// bit 30 — HIGH</span>
    #maintenance  := #diag.%X3;   <span class="c">// bit 27 — stabilité dégradée</span>
    #interference := #diag.%X0;   <span class="c">// bit 24 — interférence 60 GHz</span>

    <span class="c">// ---- Octet 9 : erreurs bloquantes ----</span>
    #defaut := #erreurs.%X7 <span class="k">OR</span> #erreurs.%X1 <span class="k">OR</span> #erreurs.%X0;
                  <span class="c">// tête        EEPROM         système</span>

    <span class="c">// ---- Octet 10 : stabilité sur les 4 bits de poids fort ----</span>
    #stabilite := BYTE_TO_USINT(SHR(IN := #etat, N := 4)) <span class="k">AND</span> 16#0F;

    <span class="c">// ---- Mesure exploitable ? ----</span>
    #mesureOK := <span class="k">NOT</span> #diag.%X2 <span class="k">AND</span> <span class="k">NOT</span> #defaut;  <span class="c">// bit 26 = Not Measurable</span>

    <span class="c">// ---- Mise à l'échelle ----
    // ⚠ Aucun gradient dans l'IODD : l'échelle dépend des réglages
    //   « unité de distance » et « position du point décimal » saisis
    //   sur l'afficheur du capteur. 0 décimale → la brute est déjà l'unité.</span>
    <span class="k">IF</span> #mesureOK <span class="k">THEN</span>
        <span class="k">CASE</span> #decimales <span class="k">OF</span>
            0: #niveau := DINT_TO_REAL(#valeurBrute);
            1: #niveau := DINT_TO_REAL(#valeurBrute) / 10.0;
            2: #niveau := DINT_TO_REAL(#valeurBrute) / 100.0;
            3: #niveau := DINT_TO_REAL(#valeurBrute) / 1000.0;
            <span class="k">ELSE</span>
               #niveau := DINT_TO_REAL(#valeurBrute) / 10000.0;
        <span class="k">END_CASE</span>;
    <span class="k">ELSE</span>
        #niveau := 0.0;
    <span class="k">END_IF</span>;
<span class="k">END_FUNCTION_BLOCK</span>`;
}
function codeLadFRS(d, r) {
  return `<span class="c">// ${d.ref} en IO-Link — adresses à adapter à la plage attribuée au port.</span>

<span class="r">Réseau 1 — Diagnostics (octet 8, lecture directe des bits)</span>
   diag.%X7
────┤ ├──────────────────────────────( niveauBas )      <span class="c">LOW</span>

   diag.%X6
────┤ ├──────────────────────────────( niveauHaut )     <span class="c">HIGH</span>

   diag.%X3
────┤ ├──────────────────────────────( maintenance )    <span class="c">stabilité dégradée</span>

   diag.%X0
────┤ ├──────────────────────────────( interference )   <span class="c">autre source 60 GHz</span>

<span class="r">Réseau 2 — Défaut bloquant (octet 9, trois bits en parallèle)</span>
   erreurs.%X7
────┤ ├──┬───────────────────────────( defaut )
   erreurs.%X1
─────┤ ├──┤
   erreurs.%X0
─────┤ ├──┘

<span class="r">Réseau 3 — Mesure exploitable ?</span>
   diag.%X2    defaut
────┤/├────────┤/├─────────────────( mesureOK )
  <span class="c">Not Measurable</span>

<span class="r">Réseau 4 — Stabilité : 4 bits de poids fort de l'octet 10</span>
      ┌──────────────┐    ┌──────────────┐
      │     SHR      │    │     AND      │
──────┤     Byte     ├────┤     Byte     ├───( stabilite )
      │IN       etat │    │IN2    16#0F  │
      │N           4 │    └──────────────┘
      └──────────────┘

<span class="r">Réseau 5 — Mise à l'échelle selon le réglage du capteur</span>
<span class="c">   ⚠ Le diviseur dépend de la « position du point décimal » réglée
   sur l'afficheur. Ici : 1 décimale → division par 10.</span>
              ┌──────────────┐    ┌──────────┐
   mesureOK   │     CONV     │    │   DIV    │
──────┤ ├─────┤ DInt →  Real ├────┤   Real   ├───( niveau )
              │IN valeurBrute│    │IN2   10.0│
              └──────────────┘    └──────────┘`;
}
function codeSclAnalog(d) {
  return `<span class="c">// ${d.ref} — boucle 4-20 mA sur carte d'entrées analogiques S7-1500
// Plage 4…20 mA  →  valeur brute 0…27648
// Réservoir de référence : 0…1000 mm</span>

<span class="k">FUNCTION_BLOCK</span> <span class="n">"FB_${d.ref}_Analog"</span>
<span class="k">VAR_INPUT</span>
    brut     : INT;    <span class="c">// mot d'entrée du module AI</span>
    niveauMin : REAL := 0.0;      <span class="c">// mm à 4 mA</span>
    niveauMax : REAL := 1000.0;   <span class="c">// mm à 20 mA</span>
<span class="k">END_VAR</span>
<span class="k">VAR_OUTPUT</span>
    niveau  : REAL;    <span class="c">// mm</span>
    valide  : BOOL;
    depHaut : BOOL;
    depBas  : BOOL;
<span class="k">END_VAR</span>
<span class="k">VAR_TEMP</span> norm : REAL; <span class="k">END_VAR</span>

<span class="k">BEGIN</span>
    <span class="c">// ---- Dépassements : hors 0…27648, la mesure n'est plus valide ----</span>
    #depBas  := (#brut &lt; 0);
    #depHaut := (#brut &gt; 27648);
    #valide  := <span class="k">NOT</span> #depBas <span class="k">AND</span> <span class="k">NOT</span> #depHaut;

    <span class="k">IF</span> #valide <span class="k">THEN</span>
        #norm   := NORM_X(MIN := 0,   VALUE := #brut, MAX := 27648);
        #niveau := SCALE_X(MIN := #niveauMin, VALUE := #norm, MAX := #niveauMax);
    <span class="k">ELSE</span>
        #niveau := 0.0;
    <span class="k">END_IF</span>;
<span class="k">END_FUNCTION_BLOCK</span>

<span class="c">// Rappel : la perte de détection se paramètre SUR LE CAPTEUR
// (3,5 mA / 21,5 mA / maintien / valeur fixe). Choisir 3,5 mA rend
// le défaut détectable côté automate — 0 mA ne l'est pas si on est en 0-20 mA.</span>`;
}
function codeLadAnalog(d) {
  return `<span class="c">// ${d.ref} — boucle 4-20 mA. Adresse %IW à adapter au module AI.</span>

<span class="r">Réseau 1 — Dépassement bas ?</span>
      ┌──────────────┐
      │      &lt;       │
──────┤     Int      ├──────────( depBas )
      │IN1      brut │
      │IN2         0 │
      └──────────────┘

<span class="r">Réseau 2 — Dépassement haut ?</span>
      ┌──────────────┐
      │      &gt;       │
──────┤     Int      ├──────────( depHaut )
      │IN1      brut │
      │IN2     27648 │
      └──────────────┘

<span class="r">Réseau 3 — Mesure valide (aucun dépassement)</span>
   depBas   depHaut
────┤/├───────┤/├─────────────( valide )

<span class="r">Réseau 4 — Mise à l'échelle 0…27648 → 0…1000 mm</span>
              ┌──────────────┐   ┌──────────────┐
   valide     │    NORM_X    │   │   SCALE_X    │
──────┤ ├─────┤ Int  →  Real ├───┤ Real →  Real ├──( niveau )
              │MIN        0  │   │MIN       0.0 │
              │VALUE   brut  │   │VALUE    norm │
              │MAX    27648  │   │MAX    1000.0 │
              └──────────────┘   └──────────────┘

<span class="c">// NORM_X ramène la valeur brute entre 0,0 et 1,0.
// SCALE_X l'étale ensuite sur la plage physique du réservoir.</span>`;
}
function codeSclProfinet(d, r) {
  return `<span class="c">// ${d.ref} — télégramme PROFIdrive standard 1 (PZD 2/2)
// Sortie (CPU → variateur) : STW1 (mot de commande) + NSOLL_A (consigne)
// Entrée (variateur → CPU) : ZSW1 (mot d'état) + NIST_A (vitesse réelle)
// ⚠ Seuls les bits STW1.0 et ZSW1.0-3 sont du standard PROFIdrive
//   universellement documenté — le reste dépend du profil complet.</span>

<span class="k">FUNCTION_BLOCK</span> <span class="n">"FB_${d.ref}"</span>
<span class="k">VAR_INPUT</span>
    zsw1        : WORD;   <span class="c">// mot d'état, lu depuis le variateur</span>
    nistA       : INT;    <span class="c">// vitesse réelle</span>
    consigneOn  : BOOL;   <span class="c">// commande "marche" venant du programme</span>
    consigneVit : INT;    <span class="c">// consigne de vitesse à envoyer</span>
<span class="k">END_VAR</span>
<span class="k">VAR_OUTPUT</span>
    stw1        : WORD;   <span class="c">// mot de commande, à écrire vers le variateur</span>
    nsollA      : INT;    <span class="c">// consigne, à écrire vers le variateur</span>
    pretEnclenchement : BOOL;   <span class="c">// ZSW1.0</span>
    pret              : BOOL;   <span class="c">// ZSW1.1</span>
    enMarche          : BOOL;   <span class="c">// ZSW1.2 — fonctionnement activé</span>
    defaut            : BOOL;   <span class="c">// ZSW1.3</span>
<span class="k">END_VAR</span>

<span class="k">BEGIN</span>
    <span class="c">// ---- Lecture : décodage des 4 bits d'état les plus standards ----</span>
    #pretEnclenchement := #zsw1.%X0;
    #pret              := #zsw1.%X1;
    #enMarche          := #zsw1.%X2;
    #defaut            := #zsw1.%X3;

    <span class="c">// ---- Écriture : commande minimale Marche/Arrêt1 (STW1 bit 0) ----
    // Une séquence de démarrage PROFIdrive complète (activation
    // progressive des bits ON, enable operation, etc.) suit le profil
    // standard — non détaillée ici, à confirmer sur le variateur.</span>
    #stw1.%X0 := #consigneOn;
    #nsollA   := #consigneVit;
<span class="k">END_FUNCTION_BLOCK</span>`;
}
function codeLadProfinet(d, r) {
  return `<span class="c">// ${d.ref} — adresses %IW/%QW à adapter à la plage attribuée par TIA.</span>

<span class="r">Réseau 1 — Décodage des bits d'état standards (ZSW1)</span>
   zsw1.%X0
────┤ ├──────────────────────────────( pretEnclenchement )

   zsw1.%X1
────┤ ├──────────────────────────────( pret )

   zsw1.%X2
────┤ ├──────────────────────────────( enMarche )

   zsw1.%X3
────┤ ├──────────────────────────────( defaut )

<span class="r">Réseau 2 — Commande Marche/Arrêt1 (STW1 bit 0)</span>
   consigneOn
────┤ ├──────────────────────────────( stw1.%X0 )

<span class="r">Réseau 3 — Consigne de vitesse (mot entier, pas de mise à l'échelle)</span>
      ┌──────────────┐
      │     MOVE     │
──────┤     Int      ├──────────( nsollA )
      │IN  consigneVit│
      └──────────────┘`;
}

/* ══════════════════════════════════════════════════════════
   ASSEMBLAGE D'UN GUIDE — utilisé par la SPA (maquette
   interactive) et par le générateur de pages statiques.
   ══════════════════════════════════════════════════════════ */

/* d, mode → l'article HTML complet d'un guide (sans chrome de page) */
function buildGuideArticle(DB, d, mode) {
  const r = rac(DB, d, mode), md = DB.modes.find(x => x.id === mode),
        proc = DB.procedures[r.procedure], mt = r.maitre ? DB.maitres.find(x => x.id === r.maitre) : null,
        a = DB.automates.find(x => x.id === 'siemens');
  let n = 0; const num = () => String(++n).padStart(2, '0');
  const P = [];

  P.push(`<div class="guide-head">
    <span class="step">Guide d’intégration</span>
    <h1 class="title">${esc(d.ref)} — raccordement ${esc(md.nom)}</h1>
    <p class="lede">${esc(d.nom)}. ${esc(d.resume)}</p>
    <div class="chain">
      <span class="chip">${esc(d.marqueNom)} ${esc(d.ref)}</span>
      ${mt ? `<span class="chip">${esc(mt.marque)} ${esc(mt.ref)}</span>` : ''}
      <span class="chip mode">${esc(md.nom)}</span>
      <span class="chip alt">${esc(a.nom)}</span>
      <span class="chip alt">${esc(d.techno)}</span>
      ${r.sens === 'sortie' ? '<span class="chip alt" style="border-color:var(--signal);color:var(--signal-deep)">Données en sortie</span>' : ''}
    </div></div>`);

  /* 1 — caractéristiques */
  P.push(`<section class="blk"><h2 data-n="${num()}">Caractéristiques de l’appareil</h2>
   <table><tbody>${d.specs.map(s => `<tr><th style="width:33%">${s[0]}</th><td>${s[1]}</td></tr>`).join('')}</tbody></table>
   ${mt ? `<div class="note"><b>Compatibilité</b>Le ${esc(mt.ref)} dispose de ${mt.ports} ports classe ${esc(mt.classe)} et gère IO-Link ${esc(mt.specIolink)} — compatible.</div>` : ''}
   </section>`);

  /* 2 — câblage */
  P.push(`<section class="blk"><h2 data-n="${num()}">Câblage</h2>
   <p style="margin:0 0 14px;color:var(--ink-2);font-size:13.5px">${esc(r.connecteur)} — ${esc(r.cable)}</p>
   <div class="pins">${connSvg(r)}
   <table><thead><tr><th>Broche</th><th>Fil</th><th>Fonction</th></tr></thead><tbody>
   ${r.pinout.map(p => `<tr><td class="num">${p.n}</td>
     <td><span class="dot" style="background:${p.hex}"></span><span class="m">${p.coul}</span> ${p.nom}</td>
     <td>${esc(p.fn)}</td></tr>`).join('')}</tbody></table></div>
   ${r.bornier ? `<div class="note info"><b>Côté maître IO-Link</b>
     Affectation des bornes sur la BaseUnit du module : ${r.bornier.map(b => `<span class="mono">${b[0]}</span> ${esc(b[1])}`).join(' · ')}</div>` : ''}
   ${r.noteMode ? `<div class="note info"><b>Version conventionnelle</b>${esc(r.noteMode)}</div>` : ''}
   ${mode === 'iolink' ? `<div class="note info"><b>Une liaison IO-Link n’utilise que 4 conducteurs</b>
     L’alimentation, le 0 V, la ligne de communication C/Q, et un quatrième non utilisé en classe A.
     Peu importe que le connecteur en compte 8 : les autres fils restent inutilisés et doivent être isolés individuellement.</div>` : ''}
   ${r.pinoutComplement ? `<div class="note info"><b>Autres broches du connecteur</b>
     ${r.pinoutComplement.map(x => `<span class="m">${x[0]}</span> ${x[1]} — ${esc(x[2])}`).join(' · ')}
     <br>Isoler individuellement tous les fils non utilisés.</div>` : ''}
   ${mode === 'iolink' && d.id === 'fr-s01' ? `<div class="note warn"><b>La règle « IO-Link = broche 4 » ne s’applique pas ici</b>
     Connecteur 8 broches propriétaire : la communication passe par la <span class="m">broche 6</span>, fil rose.
     Vérifiez toujours le brochage du fabricant plutôt que de vous fier à l’habitude.</div>` : ''}
   </section>`);

  /* 3 — réglages sur l'appareil */
  if (d.reglagesAppareil) {
    const g = d.reglagesAppareil;
    P.push(`<section class="blk"><h2 data-n="${num()}">Réglages sur l’appareil</h2>
     <p style="margin:0 0 14px;color:var(--ink-2);font-size:13.5px">${esc(g.intro)}</p>
     <table><thead><tr><th style="width:32%">Étape de l’assistant</th><th>Options</th></tr></thead>
     <tbody>${g.etapes.map(e => `<tr><th>${e[0]}</th><td>${e[1]}</td></tr>`).join('')}</tbody></table>
     <div class="note info"><b>Après l’assistant</b>${esc(g.apres)}</div></section>`);
  }

  /* 4 — procédure TIA */
  P.push(`<section class="blk"><h2 data-n="${num()}">Intégration dans TIA Portal</h2>
   <p style="margin:0 0 14px;color:var(--ink-2);font-size:13.5px">Procédure « ${esc(proc.nom)} » — commune à tous les appareils raccordés de cette façon.</p>
   <table><tbody>${proc.etapes.map((e, i) => `<tr>
     <th style="width:36%"><span style="color:var(--signal)">${String(i + 1).padStart(2, '0')}</span> ${esc(e.t)}</th>
     <td>${esc(e.d)}</td></tr>`).join('')}</tbody></table></section>`);

  /* 5 — données selon le mode */
  if (r.commande) P.push(blocCommande(r, num));
  if (mode === 'iolink' && r.donnees) P.push(blocIolink(r, num));
  if (mode === 'analogique') P.push(blocAnalog(r, num));
  if (mode === 'tor') P.push(blocTor(r, num));
  if (mode === 'profinet' && r.donnees) P.push(blocProfinet(r, num));

  /* 6 — programmation */
  if (mode === 'iolink' && r.donnees && !r.commande) P.push(r.familleIodd === 'keyence-fr'
    ? blocProg(codeSclFRS(d, r), codeLadFRS(d, r), num)
    : blocProg(codeSclIolink(d, r), codeLadIolink(d, r), num));
  if (mode === 'analogique') P.push(blocProg(codeSclAnalog(d), codeLadAnalog(d), num));
  if (mode === 'profinet' && r.donnees) P.push(blocProg(codeSclProfinet(d, r), codeLadProfinet(d, r), num));

  /* 7 — pièges + sources */
  P.push(`<section class="blk"><h2 data-n="${num()}">Les pièges</h2>
   <table><tbody>${d.pieges.map(p => `<tr><th style="width:33%">${esc(p.t)}</th><td>${esc(p.d)}</td></tr>`).join('')}</tbody></table></section>`);
  P.push(`<section class="blk"><h2 data-n="${num()}">Sources</h2>
   <p class="mono" style="margin:0;font-size:12.5px;color:var(--ink-2)">${esc(d.source)}</p></section>`);

  return `<article class="guide">${P.join('')}</article>`;
}

/* ── URL canonique d'un guide : /<automate>/<categorie>/<type>/<marque>/<id>/<mode>/ ── */
function guidePath(automateId, d, mode) {
  return `/${automateId}/${d.categorie}/${d.type}/${d.marque}/${d.id}/${mode}/`;
}

/* ── title + meta description, construits depuis les données ──
   Lus dans les résultats de recherche : c'est ce qui décide du clic. */
function metaFor(DB, d, mode) {
  const r = rac(DB, d, mode), md = DB.modes.find(x => x.id === mode);
  const mt = r.maitre ? DB.maitres.find(x => x.id === r.maitre) : null;
  const sortie = r.sens === 'sortie';

  let title;
  if (mode === 'iolink') {
    const via = mt ? `sur ${mt.ref}` : 'en IO-Link';
    title = sortie
      ? `${d.ref} ${via} dans TIA Portal — câblage et pilotage IO-Link`
      : `${d.ref} ${via} dans TIA Portal — câblage, IODD et programmation`;
  } else if (mode === 'analogique') {
    title = `${d.ref} en 4-20 mA dans TIA Portal — câblage et mise à l’échelle`;
  } else if (mode === 'tor') {
    title = `${d.ref} en tout ou rien dans TIA Portal — câblage et lecture des sorties`;
  } else if (mode === 'profinet') {
    title = `${d.ref} en PROFINET natif dans TIA Portal — GSD, télégramme et Startdrive`;
  } else {
    title = `${d.ref} en câblage 24 V — raccordement et paramétrage`;
  }

  let description = `${d.marqueNom} ${d.ref} — ${d.nom}. Raccordement ${md.nom} : brochage`;
  if (mode === 'iolink' && !sortie) description += ', structure IODD';
  if (mode === 'profinet') description += ', télégramme PROFIdrive';
  description += `, intégration TIA Portal`;
  if ((mode === 'iolink' && !sortie) || mode === 'analogique' || mode === 'profinet') description += ' et code SCL/CONT';
  description += '. Pièges de mise en service inclus.';
  if (description.length > 160) description = description.slice(0, 157).replace(/\s+\S*$/, '') + '…';

  return { title, description, path: guidePath('siemens', d, mode) };
}

/* ── appareils de la même famille IODD (hors soi-même) ── */
function familySiblings(DB, d) {
  let familleId = null;
  for (const mode in d.raccordements) {
    if (d.raccordements[mode].familleIodd) { familleId = d.raccordements[mode].familleIodd; break; }
  }
  if (!familleId) return [];
  return DB.appareils.filter(other => other.id !== d.id && Object.values(other.raccordements)
    .some(r => r.familleIodd === familleId));
}

/* ── premier mode disponible pour un appareil (pour pointer un lien) ── */
function primaryMode(d) {
  return Object.keys(d.raccordements)[0];
}

const api = {
  esc, rac, connSvg, blocIolink, blocCommande, blocAnalog, blocTor, blocProfinet, blocProg,
  codeSclIolink, codeLadIolink, codeSclFRS, codeLadFRS, codeSclAnalog, codeLadAnalog,
  codeSclProfinet, codeLadProfinet,
  buildGuideArticle, guidePath, metaFor, familySiblings, primaryMode
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Render = api;

})(typeof window !== 'undefined' ? window : globalThis);
