'use strict';
/**
 * Prueba Charon sin imprimir API keys.
 * Usa la key ofuscada de config.js vía la página (mismo path que el chat).
 */
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
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('generativelanguage') || u.includes('interactions') || u.includes(':8787')) {
      net.push({ status: r.status(), host: u.split('?')[0].slice(0, 110) });
    }
  });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    localStorage.setItem('kpk_voice_mode', 'jarvis_charon');
    localStorage.setItem('kpk_voice_user_override', '1');
    localStorage.setItem('kpk_voice_default_ver', '7');
  });

  await page.click('body');
  await page.waitForTimeout(500);

  const probe = await page.evaluate(() => {
    const cfg = window.KPK_CONFIG;
    return {
      hasCfg: !!cfg,
      keys: cfg && cfg.aiKeys ? Object.keys(cfg.aiKeys) : [],
      geminiEncLen: cfg && cfg.aiKeys && cfg.aiKeys.gemini ? String(cfg.aiKeys.gemini).length : 0,
      voiceMode: cfg && cfg.voiceMode
    };
  });
  console.log('PROBE', JSON.stringify(probe));

  const result = await page.evaluate(async () => {
    // Forzar siembra desde config sin tocar el valor en logs
    try {
      const cfg = window.KPK_CONFIG || {};
      if (cfg.aiKeys && cfg.aiKeys.gemini) {
        localStorage.setItem('ferrari_ai_key_gemini', cfg.aiKeys.gemini);
      }
    } catch (e) {}
    localStorage.setItem('kpk_voice_mode', 'jarvis_charon');
    localStorage.setItem('kpk_voice_user_override', '1');
    if (typeof window.__kpkSpeakCharon === 'function') {
      await window.__kpkSpeakCharon('Ciertamente, señor. Sistemas en línea. Soy JARVIS.');
    } else if (typeof window.__kpkSpeak === 'function') {
      await window.__kpkSpeak('Ciertamente, señor. Sistemas en línea. Soy JARVIS.');
    } else {
      return { err: 'no speak helpers' };
    }
    await new Promise((r) => setTimeout(r, 10000));
    return window.__kpkVoiceDebug ? window.__kpkVoiceDebug() : {};
  });

  const voiceLogs = logs.filter((l) =>
    /Charon|JARVIS|Gemini|Gigi\/Voz|WebSpeech|Dalia|interactions/i.test(l)
  );

  console.log(JSON.stringify({ result, net: net.slice(-20), voiceLogs: voiceLogs.slice(-40) }, null, 2));
  await browser.close();

  const charonOk = result && result.lastEngine === 'jarvis_charon';
  const geminiHit = net.some((n) => n.host.includes('generativelanguage') && (n.status === 200 || n.status === 201));
  if (charonOk) {
    console.log('PASS: Charon habló (lastEngine=jarvis_charon)');
  } else if (geminiHit) {
    console.log('PARTIAL: Gemini respondió pero engine=', result && result.lastEngine);
    process.exit(3);
  } else {
    console.error('FAIL: Charon no activó. Revisa key Gemini / modelo TTS.');
    process.exit(2);
  }
})().catch((e) => {
  console.error('TEST_FAIL', e);
  process.exit(1);
});
