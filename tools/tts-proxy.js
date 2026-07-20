/**
 * Proxy local TTS — Dalia Neural (Edge) + Mia (StreamElements vía servidor).
 * El navegador recibe 401 de StreamElements; Node no.
 *
 *   npm run tts
 *   GET http://127.0.0.1:8787/tts?text=Hola&voice=es-MX-DaliaNeural
 *   GET http://127.0.0.1:8787/se?text=Hola&voice=Mia
 */
'use strict';

const http = require('http');
const { URL } = require('url');
const { EdgeTTS } = require('edge-tts-universal');

const HOST = '127.0.0.1';
const PORT = Number(process.env.KPK_TTS_PORT || 8787);
const DEFAULT_VOICE = 'es-MX-DaliaNeural';
const SE_BASE = 'https://api.streamelements.com/kappa/v2/speech';

function cors(res, extra) {
  const headers = Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }, extra || {});
  return headers;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, cors(res, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function synthesizeEdge(text, voice, rate, pitch) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (!clean) throw new Error('text vacío');
  const tts = new EdgeTTS(clean, voice || DEFAULT_VOICE, {
    rate: rate || '+8%',
    pitch: pitch || '+2Hz',
    volume: '+0%'
  });
  const result = await tts.synthesize();
  const buf = Buffer.from(await result.audio.arrayBuffer());
  if (!buf.length) throw new Error('sin audio');
  return buf;
}

async function synthesizeStreamElements(text, voice) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 460);
  if (!clean) throw new Error('text vacío');
  const v = voice || 'Mia';
  const url = SE_BASE + '?voice=' + encodeURIComponent(v) + '&text=' + encodeURIComponent(clean);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      'Referer': 'https://streamelements.com/'
    }
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('StreamElements HTTP ' + res.status + ' ' + t.slice(0, 120));
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('StreamElements audio vacío');
  return buf;
}

function sendMp3(res, buf) {
  res.writeHead(200, cors(res, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  }));
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors());
      return res.end();
    }

    const u = new URL(req.url, `http://${HOST}:${PORT}`);

    if (u.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        voice: DEFAULT_VOICE,
        engine: 'edge-tts-universal',
        also: ['/tts (Dalia)', '/se (Mia StreamElements)']
      });
    }

    let text = u.searchParams.get('text') || '';
    let voice = u.searchParams.get('voice') || '';
    let rate = u.searchParams.get('rate') || '+8%';
    let pitch = u.searchParams.get('pitch') || '+2Hz';

    if (req.method === 'POST') {
      const raw = await readBody(req);
      if (raw) {
        try {
          const j = JSON.parse(raw);
          if (j.text) text = j.text;
          if (j.voice) voice = j.voice;
          if (j.rate) rate = j.rate;
          if (j.pitch) pitch = j.pitch;
        } catch (_) {
          text = text || raw;
        }
      }
    }

    if (u.pathname === '/tts' || u.pathname === '/dalia') {
      const audio = await synthesizeEdge(text, voice || DEFAULT_VOICE, rate, pitch);
      return sendMp3(res, audio);
    }

    if (u.pathname === '/se' || u.pathname === '/mia') {
      const audio = await synthesizeStreamElements(text, voice || 'Mia');
      return sendMp3(res, audio);
    }

    return sendJson(res, 404, { error: 'not_found', paths: ['/health', '/tts', '/se'] });
  } catch (e) {
    console.error('[tts-proxy]', e.message || e);
    sendJson(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[tts-proxy] Dalia → http://${HOST}:${PORT}/tts`);
  console.log(`[tts-proxy] Mia   → http://${HOST}:${PORT}/se`);
  console.log(`[tts-proxy] health http://${HOST}:${PORT}/health`);
});
