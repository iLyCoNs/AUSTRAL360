/**
 * Busca en YouTube un video candidato por cada POI de data/tourism-catalog.json
 * (los mismos lugares que usa Jarvis Turismo).
 *
 * Uso:
 *   node tools/find-tourism-videos.js
 *   find-tourism-videos.bat
 *
 * Salida:
 *   tools/out/tourism-videos.md   (para revisar a mano)
 *   tools/out/tourism-videos.json (IDs sugeridos)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { searchYoutube } = require('./lib/yt-search');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'data', 'tourism-catalog.json');
const OUT_DIR = path.join(__dirname, 'out');
const OUT_MD = path.join(OUT_DIR, 'tourism-videos.md');
const OUT_JSON = path.join(OUT_DIR, 'tourism-videos.json');

function queryFor(poi) {
  if (poi.youtubeSearch && String(poi.youtubeSearch).trim()) {
    return String(poi.youtubeSearch).trim();
  }
  const bits = [poi.title, 'Chile'];
  if (poi.category === 'termas') bits.push('termas');
  if (poi.category === 'rafting') bits.push('rafting');
  if (poi.category === 'trekking') bits.push('parque');
  if (poi.category === 'nieve') bits.push('volcán');
  return bits.filter(Boolean).join(' ');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(CATALOG)) {
    console.error('No existe el catálogo:', CATALOG);
    process.exit(1);
  }

  const cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const pois = Array.isArray(cat.pois) ? cat.pois : [];
  if (!pois.length) {
    console.error('Catálogo sin POIs');
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Catálogo v' + (cat.version || '?') + ' — ' + pois.length + ' lugares');
  console.log('Buscando en YouTube (puede tardar 1–3 min)...\n');

  const rows = [];
  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    const q = queryFor(poi);
    process.stdout.write('[' + (i + 1) + '/' + pois.length + '] ' + poi.id + ' … ');
    let results = [];
    let err = null;
    try {
      results = await searchYoutube(q, { limit: 5, minScore: 25 });
    } catch (e) {
      err = String(e.message || e);
    }

    const best = results[0] || null;
    const current = Array.isArray(poi.youtubeCandidates)
      ? poi.youtubeCandidates.filter(Boolean)
      : [];

    rows.push({
      id: poi.id,
      title: poi.title,
      category: poi.category,
      query: q,
      currentIds: current,
      best: best
        ? {
            id: best.id,
            title: best.title,
            url: 'https://www.youtube.com/watch?v=' + best.id,
            score: best.score,
            author: best.author || null
          }
        : null,
      alternatives: results.slice(1, 4).map((r) => ({
        id: r.id,
        title: r.title,
        url: 'https://www.youtube.com/watch?v=' + r.id,
        score: r.score
      })),
      error: err
    });

    if (err) console.log('ERROR ' + err);
    else if (best) console.log(best.id + '  (' + best.score + ')  ' + best.title.slice(0, 60));
    else console.log('sin resultado');

    // Evitar rate-limit de YouTube
    await sleep(900);
  }

  const md = [];
  md.push('# Videos YouTube — Jarvis Turismo');
  md.push('');
  md.push('Generado: ' + new Date().toISOString());
  md.push('Catálogo: `data/tourism-catalog.json` v' + (cat.version || '?'));
  md.push('');
  md.push('Revisa cada link. Si te convence, copia el ID a `youtubeCandidates` del POI.');
  md.push('');
  md.push('| # | POI | Categoría | Video sugerido | ID | Score |');
  md.push('|---|-----|-----------|----------------|----|-------|');

  rows.forEach((r, idx) => {
    const link = r.best
      ? '[' + (r.best.title || 'ver').replace(/\|/g, '/') + '](' + r.best.url + ')'
      : '—';
    md.push(
      '| ' +
        (idx + 1) +
        ' | `' +
        r.id +
        '` · ' +
        r.title +
        ' | ' +
        r.category +
        ' | ' +
        link +
        ' | `' +
        (r.best ? r.best.id : '') +
        '` | ' +
        (r.best ? r.best.score : '') +
        ' |'
    );
  });

  md.push('');
  md.push('## Detalle por lugar');
  md.push('');

  for (const r of rows) {
    md.push('### ' + r.title + ' (`' + r.id + '`)');
    md.push('- Categoría: `' + r.category + '`');
    md.push('- Búsqueda: `' + r.query + '`');
    if (r.currentIds.length) {
      md.push('- IDs actuales en catálogo: `' + r.currentIds.join('`, `') + '`');
    } else {
      md.push('- IDs actuales en catálogo: *(ninguno)*');
    }
    if (r.best) {
      md.push('- **Sugerido:** ' + r.best.url);
      md.push('  - Título: ' + r.best.title);
      md.push('  - ID: `' + r.best.id + '`');
      md.push('  - Pegar en JSON:');
      md.push('```json');
      md.push('  "youtubeCandidates": ["' + r.best.id + '"],');
      md.push('```');
    } else {
      md.push('- **Sugerido:** *(sin resultado confiable)*');
      if (r.error) md.push('- Error: ' + r.error);
    }
    if (r.alternatives && r.alternatives.length) {
      md.push('- Alternativas:');
      r.alternatives.forEach((a) => {
        md.push('  - ' + a.url + ' — ' + a.title + ' (score ' + a.score + ')');
      });
    }
    md.push('');
  }

  fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        catalogVersion: cat.version || null,
        count: rows.length,
        pois: rows
      },
      null,
      2
    ),
    'utf8'
  );

  const withBest = rows.filter((r) => r.best).length;
  console.log('\nListo.');
  console.log('  Con video sugerido: ' + withBest + '/' + rows.length);
  console.log('  Markdown: ' + OUT_MD);
  console.log('  JSON:     ' + OUT_JSON);
  console.log('\nAbre el .md, revisa los links y copia los IDs buenos al catálogo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
