/**
 * Búsqueda de videos YouTube desde Node (el navegador no puede por CORS).
 * Parsea resultados de youtube.com/results + valida oEmbed.
 */
'use strict';

function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTitle(query, title) {
  const q = _norm(query);
  const t = _norm(title);
  if (!q || !t) return 0;
  if (t.includes(q) || q.includes(t)) return 100;
  const qWords = q.split(' ').filter((w) => w.length > 2);
  if (!qWords.length) return 0;
  let hit = 0;
  for (const w of qWords) {
    if (t.includes(w)) hit++;
  }
  const ratio = hit / qWords.length;
  let score = Math.round(ratio * 80);
  // Bonus Chile / sur / termas / etc. si están en ambos
  if (t.includes('chile') && q.includes('chile')) score += 5;
  if (hit >= 2) score += 10;
  return Math.min(100, score);
}

function extractYtInitialData(html) {
  const marker = 'ytInitialData';
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const eq = html.indexOf('=', i + marker.length);
  const start = html.indexOf('{', eq);
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  for (let p = start; p < html.length; p++) {
    const ch = html[p];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = p + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start, end));
  } catch (_) {
    return null;
  }
}

function walkVideoRenderers(data, out) {
  if (!data || typeof data !== 'object') return;
  if (data.videoRenderer && data.videoRenderer.videoId) {
    const vr = data.videoRenderer;
    const title =
      (vr.title && vr.title.runs && vr.title.runs.map((x) => x.text).join('')) ||
      (vr.title && vr.title.simpleText) ||
      '';
    out.push({ id: vr.videoId, title: String(title || '').trim() });
    return;
  }
  for (const k of Object.keys(data)) walkVideoRenderers(data[k], out);
}

async function fetchYoutubeSearchHtml(query) {
  const url =
    'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(query) +
    '&sp=EgIQAQ%253D%253D'; // filtro: video
  const r = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!r.ok) throw new Error('YouTube search HTTP ' + r.status);
  return r.text();
}

async function validateOEmbed(id) {
  if (!id || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;
  try {
    const url =
      'https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id) +
      '&format=json';
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.title) return null;
    return { id, title: j.title, thumb: j.thumbnail_url || null, author: j.author_name || null };
  } catch (_) {
    return null;
  }
}

/**
 * @param {string} query
 * @param {{ limit?: number, minScore?: number }} [opts]
 */
async function searchYoutube(query, opts) {
  const limit = (opts && opts.limit) || 6;
  const minScore = (opts && opts.minScore) != null ? opts.minScore : 35;
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!q) return [];

  const html = await fetchYoutubeSearchHtml(q);
  const data = extractYtInitialData(html);
  const raw = [];
  if (data) walkVideoRenderers(data, raw);
  if (!raw.length) {
    const ids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
    for (const id of [...new Set(ids)].slice(0, 12)) {
      raw.push({ id, title: '' });
    }
  }

  const seen = new Set();
  const ranked = [];
  for (const v of raw) {
    if (!v.id || seen.has(v.id)) continue;
    seen.add(v.id);
    const score = scoreTitle(q, v.title || '');
    ranked.push({ id: v.id, title: v.title || '', score });
  }
  ranked.sort((a, b) => b.score - a.score);

  const out = [];
  for (const cand of ranked) {
    if (out.length >= limit) break;
    // Si no hay título del scrape, aún validamos oEmbed
    if (cand.title && cand.score < minScore) continue;
    const ok = await validateOEmbed(cand.id);
    if (!ok) continue;
    const finalScore = Math.max(cand.score, scoreTitle(q, ok.title));
    if (finalScore < minScore) continue;
    out.push({
      id: ok.id,
      title: ok.title,
      thumb: ok.thumb,
      author: ok.author,
      score: finalScore,
      source: 'youtube_search'
    });
  }
  return out;
}

module.exports = {
  searchYoutube,
  validateOEmbed,
  scoreTitle
};
