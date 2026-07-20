'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const logs = [];
  const net = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes(':8787') || u.includes('streamelements') || u.includes('elevenlabs') || u.includes('translate.google')) {
      net.push({ status: r.status(), url: u.slice(0, 120), type: r.headers()['content-type'] || '' });
    }
  });

  await page.goto('http://127.0.0.1:8765/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    localStorage.setItem('kpk_voice_mode', 'local_dalia');
    localStorage.setItem('kpk_voice_user_override', '1');
    localStorage.setItem('kpk_voice_default_ver', '6');
  });

  await page.click('body');
  await page.waitForTimeout(800);

  const result = await page.evaluate(async () => {
    if (typeof window.__kpkSpeak !== 'function') return { err: 'no __kpkSpeak' };
    await window.__kpkSpeak('Hola, esta es la prueba de voz humana Dalia.');
    await new Promise((r) => setTimeout(r, 2500));
    return window.__kpkVoiceDebug ? window.__kpkVoiceDebug() : {};
  });

  const voiceLogs = logs.filter((l) =>
    /Gigi\/Voz|Ferrari\/IA|Stream|Dalia|WebSpeech|proxy|ElevenLabs|local|ROBOT|Mia/i.test(l)
  );

  console.log(JSON.stringify({ result, net, voiceLogs: voiceLogs.slice(-50) }, null, 2));
  await browser.close();

  const usedLocal = net.some((n) => n.url.includes(':8787/tts') && n.status === 200);
  const usedRobot = /WebSpeech|ROBOT/i.test(voiceLogs.join('\n')) && !/Dalia Neural LOCAL/i.test(voiceLogs.join('\n'));
  if (!usedLocal) {
    console.error('FAIL: no se llamó al proxy Dalia /tts');
    process.exit(2);
  }
  console.log('PASS: proxy Dalia respondió audio');
})().catch((e) => {
  console.error('TEST_FAIL', e);
  process.exit(1);
});
