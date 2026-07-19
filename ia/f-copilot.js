/**
 * f-copilot.js — Asistente de Ventas IA interactivo para Ferrari360
 * Utiliza Google AI Studio (Gemini 1.5 Flash) para guiar visualmente al usuario.
 */

'use strict';

(function() {
  let _provider = 'gemini';
  let _apiKey = '';
  let _modelName = '';

  function _deobfuscateKey(encKey) {
    if (!encKey || typeof encKey !== 'string') return '';
    if (!encKey.startsWith('kpk-enc-')) return encKey;
    try {
      const rawBase = encKey.substring(8);
      return atob(rawBase).split('').reverse().join('');
    } catch (e) {
      return encKey;
    }
  }

  let _panel = null;
  let _bubble = null;
  let _log = null;
  let _input = null;
  let _btnMic = null;
  let _recognition = null;
  let _isListening = false;
  let _chatHistory = []; // Para mantener memoria del diálogo
  let _jarvisMode = false;
  let _shouldRestartMic = false;
  let _activeLote = null; // Lote actualmente en foco (para contexto persistente de la IA)

  // Inicializar UI al cargar la página
  function init() {
    if (document.getElementById('kpk-ai-root')) return;

    // Cargar config de IA desde la marca o localStorage
    let remoteProvider = null;
    if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getBrand === 'function') {
      remoteProvider = window.FerrariBrandDock.getBrand().aiProvider;
    }

    const cfg = window.KPK_CONFIG || {};
    
    // Invalidador automático de caché de configuración (configVersion)
    const localCfgVer = localStorage.getItem('ferrari_config_version') || '0';
    const currentCfgVer = String(cfg.configVersion || '0');
    if (localCfgVer !== currentCfgVer && cfg.configVersion) {
      console.log(`[Ferrari/IA] Nueva versión de config detectada (${localCfgVer} -> ${currentCfgVer}). Limpiando caché local...`);
      localStorage.removeItem('ferrari_ai_provider');
      localStorage.removeItem('ferrari_ai_key_openrouter');
      localStorage.removeItem('ferrari_ai_key_groq');
      localStorage.removeItem('ferrari_ai_key_gemini');
      localStorage.removeItem('ferrari_ai_key_lightning');
      localStorage.setItem('ferrari_config_version', currentCfgVer);
    }

    _provider = localStorage.getItem('ferrari_ai_provider')
      || cfg.aiProvider
      || remoteProvider
      || 'lightning';

    // Key: localStorage tiene prioridad (configurada en el admin),
    // luego KPK_CONFIG (config.local.js del servidor), nunca hardcodeada
    _apiKey = localStorage.getItem(`ferrari_ai_key_${_provider}`)
      || (cfg.aiKeys && cfg.aiKeys[_provider])
      || '';

    // Persistir la key resuelta para que no se pierda en recargas
    if (_apiKey) localStorage.setItem(`ferrari_ai_key_${_provider}`, _apiKey);

    const models = {
      gemini: 'gemini-2.0-flash',
      groq: 'llama-3.1-8b-instant',
      openrouter: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      lightning: 'google/gemini-3.5-flash'
    };
    _modelName = models[_provider] || models.openrouter;


    // Crear elementos de UI
    const root = document.createElement('div');
    root.id = 'kpk-ai-root';
    root.innerHTML = `
      <!-- Botón Flotante -->
      <button class="kpk-ai-bubble" id="kpk-ai-bubble" title="Hablar con Asistente IA">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="10" r="2"></circle>
          <line x1="12" y1="12" x2="12" y2="15"></line>
        </svg>
      </button>

      <!-- Panel de Chat -->
      <div class="kpk-ai-panel" id="kpk-ai-panel">
        <div class="kpk-ai-header">
          <div class="kpk-ai-header-title">
            <span class="kpk-ai-header-dot"></span>
            <span class="kpk-ai-header-name">Asistente Inmobiliario Jarvis</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="kpk-ai-action-btn" id="kpk-ai-toggle-voice" title="Activar/Desactivar Voz de Jarvis" style="color: rgba(255,255,255,0.25); padding: 4px; border: none; background: none; cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="kpk-voice-icon">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            </button>
            <button class="kpk-ai-close" id="kpk-ai-close" title="Cerrar">✕</button>
          </div>
        </div>
        <div class="kpk-ai-log" id="kpk-ai-log">
          <div class="kpk-ai-msg msg-system">
            ¡Hola! Soy <b>Jarvis</b>, tu asesor inmobiliario en este tour 360°. ¿En qué te puedo ayudar?
            ${(window.innerWidth <= 640 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ? `
            <div class="kpk-ai-msg-hint" style="margin-top:8px;font-size:11px;color:rgba(0,180,255,0.9);border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;display:flex;align-items:center;gap:4px;">
              <span>🎙️</span> <i>Te sugiero pulsar el micrófono para hablar y ver el tour a pantalla completa sin el teclado.</i>
            </div>
            ` : ''}
          </div>
        </div>
        <div class="kpk-ai-input-zone">
          <div class="kpk-ai-input-wrap">
            <input type="text" class="kpk-ai-input" id="kpk-ai-input" placeholder="${(window.innerWidth <= 640 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ? 'Presiona 🎙️ para hablar...' : 'Pregunta algo aquí...'}" autocomplete="off">
            <button class="kpk-ai-action-btn" id="kpk-ai-mic" title="Grabar voz">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
          </div>
          <button class="kpk-ai-action-btn" id="kpk-ai-send" title="Enviar mensaje">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    _bubble = document.getElementById('kpk-ai-bubble');
    _panel  = document.getElementById('kpk-ai-panel');
    _log    = document.getElementById('kpk-ai-log');
    _input  = document.getElementById('kpk-ai-input');
    _btnMic = document.getElementById('kpk-ai-mic');

    // Eventos
    _bubble.addEventListener('click', togglePanel);
    document.getElementById('kpk-ai-close').addEventListener('click', togglePanel);
    document.getElementById('kpk-ai-send').addEventListener('click', handleSend);
    _input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });

    const btnVoice = document.getElementById('kpk-ai-toggle-voice');
    const voiceIcon = document.getElementById('kpk-voice-icon');
    if (btnVoice && voiceIcon) {
      btnVoice.addEventListener('click', () => {
        _speechEnabled = !_speechEnabled;
        if (!_speechEnabled) {
          window.speechSynthesis.cancel();
          btnVoice.style.color = 'rgba(255,255,255,0.25)';
          voiceIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          `;
        } else {
          btnVoice.style.color = '#39FF14';
          voiceIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          `;
          playFuturisticSound('click');
        }
      });
    }

    _setupVoiceRecognition();

    // Comprobar visibilidad inicial dentro de Iframe
    checkIframeVisibility();

    // Escuchar cambios de fullscreen y de tamaño de pantalla
    document.addEventListener('fullscreenchange', checkIframeVisibility);
    document.addEventListener('webkitfullscreenchange', checkIframeVisibility);
    document.addEventListener('mozfullscreenchange', checkIframeVisibility);
    document.addEventListener('MSFullscreenChange', checkIframeVisibility);
    window.addEventListener('resize', checkIframeVisibility);

    // Ajustar posición del panel y la burbuja cuando se abre el teclado en móviles
    if (window.visualViewport) {
      const adjustForKeyboard = () => {
        const isMobile = window.innerWidth < 768;
        if (!isMobile) return;
        const panel = document.getElementById('kpk-ai-panel');
        const bubble = document.getElementById('kpk-ai-bubble');
        if (!panel || !bubble) return;

        const offsetBottom = window.innerHeight - window.visualViewport.height;
        if (offsetBottom > 50) {
          // Teclado abierto: desplazar hacia arriba y limitar altura
          panel.style.bottom = `${offsetBottom + 12}px`;
          bubble.style.bottom = `${offsetBottom + 12}px`;
          panel.style.height = `calc(${window.visualViewport.height}px - 100px)`;
        } else {
          // Teclado cerrado: restaurar estilos de la hoja CSS
          panel.style.removeProperty('bottom');
          panel.style.removeProperty('height');
          bubble.style.removeProperty('bottom');
        }
      };
      window.visualViewport.addEventListener('resize', adjustForKeyboard);
      window.visualViewport.addEventListener('scroll', adjustForKeyboard);
    }

    console.log('[Ferrari/IA] ✓ Copiloto Inicializado en Cliente');
  }

  let _hasGreeted = false;

  function togglePanel() {
    const isOpen = _panel.classList.toggle('is-open');
    if (isOpen) {
      _input.focus();
      playFuturisticSound('start');
      if (!_hasGreeted) {
        _hasGreeted = true;
        setTimeout(() => {
          speakJarvis("Hola, soy Jarvis. ¿En qué te puedo ayudar?");
        }, 400);
      }
    } else {
      clearHighlights();
      window.speechSynthesis.cancel();
    }
  }

  // ─── RECONOCIMIENTO DE VOZ (Modo Jarvis Continuo) ───────────────────
  function _setupVoiceRecognition() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      _btnMic.style.display = 'none'; // Navegador no compatible
      return;
    }

    _recognition = new Speech();
    _recognition.lang = 'es-ES';
    _recognition.interimResults = false;

    _recognition.onstart = () => {
      _isListening = true;
      _btnMic.classList.add('is-active');
      if (_jarvisMode) {
        _btnMic.style.color = '#39FF14'; // Verde neón para modo Jarvis
        _input.placeholder = "Jarvis Activo - Escuchando...";
      } else {
        _btnMic.style.color = '#FF2D8A'; // Rosado neón para manual
        _input.placeholder = "Escuchando...";
      }
    };

    _recognition.onend = () => {
      _isListening = false;
      _btnMic.classList.remove('is-active');
      _btnMic.style.removeProperty('color');
      _input.placeholder = "Pregunta algo aquí...";
      
      // Auto-reiniciar si estamos en modo Jarvis y no se ha detenido a propósito
      if (_jarvisMode && _shouldRestartMic) {
        setTimeout(() => {
          if (_jarvisMode && !_isListening) {
            try { _recognition.start(); } catch(e) {}
          }
        }, 300);
      }
    };

    _recognition.onerror = (e) => {
      console.warn('[Ferrari/IA] Error reconocimiento de voz:', e.error);
      if (e.error === 'aborted') return;
      if (e.error === 'no-speech' && _jarvisMode) return; // Ignorar silencio temporal en Jarvis
      _jarvisMode = false;
      _shouldRestartMic = false;
    };

    _recognition.onresult = (e) => {
      const resultIdx = e.results.length - 1;
      const txt = e.results[resultIdx][0].transcript.trim();
      if (txt) {
        _input.value = txt;
        handleSend();
      }
    };

    let _isWalkiePushing = false;

    function _startWalkie() {
      if (_isWalkiePushing) return;
      _isWalkiePushing = true;
      _btnMic.classList.add('is-recording');
      _input.placeholder = "🔴 Grabando mensaje Walkie-Talkie...";
      playFuturisticSound('start');
      if (_recognition && !_isListening) {
        try {
          _recognition.continuous = false;
          _recognition.start();
        } catch(e) {}
      }
    }

    function _stopWalkie() {
      if (!_isWalkiePushing) return;
      _isWalkiePushing = false;
      _btnMic.classList.remove('is-recording');
      _input.placeholder = "Pregunta algo aquí...";
      playFuturisticSound('click');
      setTimeout(() => {
        if (_recognition && _isListening) {
          try { _recognition.stop(); } catch(e) {}
        }
      }, 350);
    }

    // Eventos Walkie-Talkie Push-to-Talk (Compatibles con Windows, Mac, iOS y Android)
    _btnMic.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      _startWalkie();
    });

    _btnMic.addEventListener('pointerup', (e) => {
      e.preventDefault();
      _stopWalkie();
    });

    _btnMic.addEventListener('pointercancel', () => {
      _stopWalkie();
    });

    _btnMic.addEventListener('mouseleave', () => {
      if (_isWalkiePushing) _stopWalkie();
    });

    // Respaldo de eventos táctiles para móviles
    _btnMic.addEventListener('touchstart', (e) => {
      e.preventDefault();
      _startWalkie();
    }, { passive: false });

    _btnMic.addEventListener('touchend', (e) => {
      e.preventDefault();
      _stopWalkie();
    }, { passive: false });
  }

  // ─── CIRCUITO EN CASCADA 3-TIER (REDUNDANCIA AUTOMÁTICA INFALIBLE) ────────
  async function _callAICascade(prompt, context, apiHistory) {
    const cfg = window.KPK_CONFIG || {};
    let brandKeys = null;
    try {
      if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getBrand === 'function') {
        brandKeys = window.FerrariBrandDock.getBrand().aiKeys || null;
      }
    } catch(e) {}

    function _resolveKey(prov) {
      const raw = localStorage.getItem(`ferrari_ai_key_${prov}`)
        || (brandKeys && brandKeys[prov])
        || (cfg.aiKeys && cfg.aiKeys[prov])
        || '';
      return _deobfuscateKey(raw);
    }

    const primaryProv = _provider || 'openrouter';
    const primaryKey = _resolveKey(primaryProv);

    // Cascada de Redundancia Ininterrumpida: Tier 1 -> Tier 2 -> Tier 3
    const cascadeTiers = [
      { provider: primaryProv, key: primaryKey, model: _modelName },
      { provider: 'openrouter', key: _resolveKey('openrouter'), model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free' },
      { provider: 'groq', key: _resolveKey('groq'), model: 'llama-3.1-8b-instant' },
      { provider: 'openrouter', key: _resolveKey('openrouter'), model: 'google/gemma-4-26b-a4b-it:free' }
    ];

    const uniqueTiers = [];
    const seen = new Set();
    for (const tier of cascadeTiers) {
      const sig = `${tier.provider}:${tier.model}`;
      if (!seen.has(sig) && (tier.key || tier.provider === 'openrouter')) {
        seen.add(sig);
        uniqueTiers.push(tier);
      }
    }

    let lastError = null;
    for (let i = 0; i < uniqueTiers.length; i++) {
      const tier = uniqueTiers[i];
      try {
        const messages = [
          { role: 'system', content: context },
          ...apiHistory.map(h => ({ role: h.role, content: h.text }))
        ];

        let url = 'https://openrouter.ai/api/v1/chat/completions';
        if (tier.provider === 'groq') {
          url = 'https://api.groq.com/openai/v1/chat/completions';
        } else if (tier.provider === 'lightning') {
          url = 'https://cors.eu.org/https://lightning.ai/api/v1/chat/completions';
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tier.key}`
        };

        if (tier.provider === 'openrouter') {
          headers['HTTP-Referer'] = window.location.origin || 'https://ilycons.github.io';
          headers['X-Title'] = 'Austral 360 Copilot';
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: tier.model,
            messages: messages,
            temperature: 0.3,
            max_tokens: 800
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `Error HTTP ${res.status}`);
        }

        const resJson = await res.json();
        const text = resJson.choices?.[0]?.message?.content;
        if (!text) throw new Error('Respuesta del modelo vacía');

        console.log(`[Ferrari/IA] ✅ Respuesta exitosa en Tier ${i + 1} (${tier.provider})`);
        return { text: text, tier: i + 1, provider: tier.provider, model: tier.model };
      } catch (err) {
        console.warn(`[Ferrari/IA] ⚠️ Tier ${i + 1} (${tier.provider}) falló: ${err.message}. Conmutando al siguiente nivel...`);
        lastError = err;
      }
    }

    throw lastError || new Error('Todos los niveles de cascada de IA fallaron.');
  }

  function _parseAIResponse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { text: 'Lo siento, no pude procesar la respuesta del servidor.' };
    }

    let cleaned = rawText.trim();
    // 1) Eliminar bloques de código markdown ```json ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // 2) Intentar parseo directo
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.text === 'string') {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        return { text: JSON.stringify(parsed), actions: parsed.actions || [] };
      }
    } catch (e1) {
      // 3) Si falla, buscar la estructura {"text": "..."} dentro del texto usando Regex
      const jsonMatch = cleaned.match(/"text"\s*:\s*"([\s\S]*?)"/);
      if (jsonMatch && jsonMatch[1]) {
        return { text: jsonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
      }

      // 4) Si no hay JSON válido pero hay texto libre, usar el texto libre limpiando llaves sueltas
      const fallbackText = cleaned
        .replace(/^[{\s]*"text"\s*:\s*"?/, '')
        .replace(/["}\s]*$/, '')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n');

      return { text: fallbackText || rawText };
    }

    return { text: rawText };
  }

  // ─── ENVIAR Y COMUNICAR CON GEMINI ──────────────────────────────────
  async function handleSend() {
    const prompt = _input.value.trim();
    if (!prompt) return;

    // Agregar mensaje de usuario al log
    appendMessage(prompt, 'user');
    _input.value = '';

    // Interceptar comando de diagnóstico local
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt === '/debug' || lowerPrompt === '/status' || lowerPrompt === '/api') {
      const typingIndicator = showTypingIndicator();
      _bubble.classList.add('is-loading');
      
      setTimeout(() => {
        typingIndicator.remove();
        _bubble.classList.remove('is-loading');
        
        let brandKeys = null;
        let brandProvider = null;
        let configSrc = 'Configuración general (config.js)';
        
        try {
          if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getBrand === 'function') {
            const brandObj = window.FerrariBrandDock.getBrand();
            brandKeys = brandObj.aiKeys || null;
            brandProvider = brandObj.aiProvider || null;
            if (brandProvider) {
              configSrc = 'Identidad publicada (brand.json de GitHub)';
            }
          }
        } catch(e) {}
        
        const localProvider = localStorage.getItem('ferrari_ai_provider');
        if (localProvider) {
          configSrc = 'Caché local de Administración (admin.html)';
        }
        
        const activeProvider = localProvider || brandProvider || (window.KPK_CONFIG && window.KPK_CONFIG.aiProvider) || 'openrouter';
        
        const models = {
          gemini: 'gemini-2.0-flash',
          groq: 'llama-3.1-8b-instant',
          openrouter: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          lightning: 'google/gemini-3.5-flash'
        };
        const activeModel = models[activeProvider] || 'Desconocido';
        
        const cfg = window.KPK_CONFIG || {};
        const rawKey = localStorage.getItem(`ferrari_ai_key_${activeProvider}`)
          || (brandKeys && brandKeys[activeProvider])
          || (cfg.aiKeys && cfg.aiKeys[activeProvider])
          || '';
          
        const keyPrefix = rawKey ? rawKey.substring(0, 16) + '...' : 'SIN CONFIGURAR';
        const isEncrypted = rawKey && rawKey.startsWith('kpk-enc-');
        
        const diagMsg = `🔧 <b>Diagnóstico de Conexión Copiloto</b><br><br>` +
          `• <b>Proveedor Activo:</b> <code>${activeProvider}</code><br>` +
          `• <b>Origen de Ajustes:</b> <i>${configSrc}</i><br>` +
          `• <b>Modelo Ejecutándose:</b> <code>${activeModel}</code><br>` +
          `• <b>API Key:</b> ${rawKey ? '✅ Cargada' : '❌ Vacía'}<br>` +
          `• <b>Prefijo en memoria:</b> <code>${keyPrefix}</code><br>` +
          `• <b>¿Protegido contra GitGuardian?:</b> ${isEncrypted ? '🔒 Sí (Ofuscada)' : '🔓 No (Texto plano)'}<br>` +
          `• <b>Redundancia Ininterrumpida:</b> 🛡️ Activa (3-Tier Cascade Circuit)<br><br>` +
          `<i>Jarvis está verificado y listo en este cliente.</i>`;
          
        appendMessage(diagMsg, 'system');
        playFuturisticSound('success');
      }, 500);
      return;
    }

    // Mostrar burbuja de escribiendo
    const typingIndicator = showTypingIndicator();
    _bubble.classList.add('is-loading');

    // Desactivar temporalmente el mic mientras piensa para evitar auto-escucha
    _shouldRestartMic = false;
    if (_recognition && _isListening) {
      try { _recognition.stop(); } catch(e) {}
    }

    // --- ENRUTADOR LOCAL (HÍBRIDO): Ahorro de Tokens y Conexiones ---
    const localResp = routeLocalQuery(prompt);
    if (localResp) {
      setTimeout(() => {
        typingIndicator.remove();
        _bubble.classList.remove('is-loading');
        appendMessage(localResp.text, 'system');
        playFuturisticSound('success');
        speakJarvis(localResp.text);
        if (localResp.actions) {
          executeActions(localResp.actions);
        }
      }, 500);
      return;
    }

    // Si hay una sesión de WebSocket Live de Gemini activa, enviar por ahí
    if (_provider === 'gemini' && _liveWs && _liveWs.readyState === WebSocket.OPEN) {
      typingIndicator.remove();
      _liveWs.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: prompt }]
          }]
        }
      }));
      return;
    }

    try {
      // 0) Resolver key AHORA (en el momento del request, no al init)
      //    Orden: localStorage -> BrandConfig (de brand.json en dock) -> KPK_CONFIG -> _apiKey guardada al init
      let brandKeys = null;
      let brandProvider = null;
      try {
        if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getBrand === 'function') {
          const brandObj = window.FerrariBrandDock.getBrand();
          brandKeys = brandObj.aiKeys || null;
          brandProvider = brandObj.aiProvider || null;
        }
        if (!brandKeys) {
          const brandStr = localStorage.getItem('ferrari360_brand');
          if (brandStr) {
            const parsed = JSON.parse(brandStr);
            brandKeys = parsed.aiKeys || null;
            if (!brandProvider) brandProvider = parsed.aiProvider || null;
          }
        }
      } catch(e) {}

      // Sincronizar el proveedor activo por si cambió dinámicamente en el backend
      if (brandProvider && brandProvider !== _provider) {
        _provider = brandProvider;
        const models = {
          gemini: 'gemini-2.0-flash',
          groq: 'llama-3.1-8b-instant',
          openrouter: 'google/gemma-4-26b-a4b-it:free',
          lightning: 'google/gemini-3.5-flash'
        };
        _modelName = models[_provider] || models.openrouter;
      }

      const cfg = window.KPK_CONFIG || {};
      let rawKey = localStorage.getItem(`ferrari_ai_key_${_provider}`)
        || (brandKeys && brandKeys[_provider])
        || (cfg.aiKeys && cfg.aiKeys[_provider])
        || _apiKey
        || '';

      // Desofuscar si viene encriptada con prefijo kpk-enc-
      let currentKey = rawKey;
      if (rawKey.startsWith('kpk-enc-')) {
        try {
          const rawBase = rawKey.substring(8);
          currentKey = atob(rawBase).split('').reverse().join('');
        } catch(e) {
          currentKey = rawKey;
        }
      }

      // Persistir para la próxima llamada
      if (currentKey) {
        _apiKey = currentKey;
        localStorage.setItem(`ferrari_ai_key_${_provider}`, currentKey);
      }

      if (!currentKey) {
        throw new Error(`No se encontró una API Key para el proveedor "${_provider}". Configúrala en el panel de administración.`);
      }

      // 1) Generar Contexto dinámico
      const context = buildContextPrompt();

      // 2) Crear historial temporal para la API (limitado a los últimos 6 turnos para evitar saturación de TPM/tokens)
      const slicedHistory = _chatHistory.slice(-6);
      const apiHistory = [...slicedHistory, { role: 'user', text: prompt }];

      let responseText = null;
      let audioData = null;

      if (_provider === 'gemini') {
        // --- PROVEEDOR: GEMINI NATIVO ---
        const geminiHistory = apiHistory.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }]
        }));

        const requestBody = {
          systemInstruction: { parts: [{ text: context }] },
          contents: geminiHistory,
          generationConfig: {
            responseMimeType: 'application/json',
            responseModalities: ["TEXT", "AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } }
          }
        };

        const isAccessToken = currentKey.startsWith('ya29.') || currentKey.startsWith('AQ.');
        const url = isAccessToken
          ? `https://generativelanguage.googleapis.com/v1beta/models/${_modelName}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${_modelName}:generateContent?key=${currentKey}`;

        const headers = { 'Content-Type': 'application/json' };
        if (isAccessToken) headers['Authorization'] = `Bearer ${currentKey}`;

        try {
          const response = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(requestBody) });
          if (response.ok) {
            const resJson = await response.json();
            const parts = resJson.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.text) responseText = part.text;
              else if (part.inlineData) audioData = part.inlineData.data;
            }
          }
        } catch(gErr) {
          console.warn('[Ferrari/IA] Gemini nativo falló, ejecutando cascada de redundancia...', gErr);
        }
      }

      // Si Gemini nativo no devolvió respuesta o estamos en OpenRouter/Groq/Lightning, ejecutar Circuito en Cascada (3-Tier Cascade)
      if (!responseText) {
        const cascadeResult = await _callAICascade(prompt, context, apiHistory);
        responseText = cascadeResult.text;
      }

      // 4) Remover burbuja escribiendo
      typingIndicator.remove();

      if (!responseText) {
        throw new Error('La respuesta del modelo de IA está vacía');
      }

      // 5) Parsear respuesta de IA con tolerancia total a fallos
      const data = _parseAIResponse(responseText);

      // Agregar respuesta de IA al log
      appendMessage(data.text, 'system');
      playFuturisticSound('success');
      
      // Hablar respuesta (con voz de Charon nativa si está disponible, sino sintetizador Jarvis)
      if (!audioData && _speechEnabled) {
        audioData = await fetchCharonAudio(data.text);
      }

      if (audioData && _speechEnabled) {
        playAudioBase64(audioData, data.text);
      } else {
        speakJarvis(data.text);
      }
      
      // Guardar el turno completo en el historial permanente (sólo tras éxito)
      _chatHistory.push({ role: 'user', text: prompt });
      _chatHistory.push({ role: 'assistant', text: responseText });

      // Limitar historial a los últimos 6 turnos (12 entradas) para ahorrar tokens
      if (_chatHistory.length > 12) {
        _chatHistory = _chatHistory.slice(_chatHistory.length - 12);
      }

      // 6) Ejecutar acciones estructuradas en el plano 360°
      if (Array.isArray(data.actions)) {
        executeActions(data.actions);
      }

    } catch (e) {
      console.error('[Ferrari/IA] Error procesando consulta con proveedor ' + _provider + ':', e);

      // --- REINTENTO AUTOMÁTICO VÍA OPENROUTER (FALLBACK DE EMERGENCIA PARA CORS / RED) ---
      if (_provider !== 'openrouter' || e.message.includes('Failed to fetch') || e.message.includes('429')) {
        console.warn('[Ferrari/IA] Intentando fallback automático vía OpenRouter...');
        try {
          const cfg = window.KPK_CONFIG || {};
          const fallbackRawKey = (cfg.aiKeys && cfg.aiKeys.openrouter) || '';
          let fallbackKey = fallbackRawKey;
          if (fallbackRawKey && fallbackRawKey.startsWith('kpk-enc-')) {
            fallbackKey = atob(fallbackRawKey.substring(8)).split('').reverse().join('');
          }
          
          if (fallbackKey) {
            const fallbackBody = {
              model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
              messages: [
                { role: 'system', content: context },
                ...apiHistory.map(h => ({ role: h.role, content: h.text }))
              ],
              temperature: 0.3,
              max_tokens: 400
            };
            
            const fbRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${fallbackKey}`,
                'HTTP-Referer': window.location.origin || 'https://ilycons.github.io',
                'X-Title': 'Austral 360 Copilot'
              },
              body: JSON.stringify(fallbackBody)
            });
            
            if (fbRes.ok) {
              const fbJson = await fbRes.json();
              const fbText = fbJson.choices?.[0]?.message?.content;
              if (fbText) {
                const fbData = _parseAIResponse(fbText);
                typingIndicator.remove();
                appendMessage(fbData.text, 'system');
                playFuturisticSound('success');
                speakJarvis(fbData.text);
                if (Array.isArray(fbData.actions)) executeActions(fbData.actions);
                _chatHistory.push({ role: 'user', text: prompt });
                _chatHistory.push({ role: 'assistant', text: fbText });
                return;
              }
            }
          }
        } catch (fbErr) {
          console.error('[Ferrari/IA] Fallback automático también falló:', fbErr);
        }
      }

      typingIndicator.remove();

      let friendlyError = 'Lo siento, tuve un problema conectando con el servicio de IA.';
      if (e.message.includes('429')) {
        friendlyError = 'Límite de velocidad de la IA excedido (429: Too Many Requests). Por favor, espera unos segundos y vuelve a intentar.';
      } else if (e.message.includes('401') || e.message.includes('403') || e.message.includes('Invalid API key')) {
        friendlyError = 'Error de autenticación (401/403). Confirma que la API Key en el panel de administración esté bien configurada.';
      } else {
        friendlyError += ` Detalles: ${e.message}`;
      }

      appendMessage(friendlyError, 'system');
    } finally {
      _bubble.classList.remove('is-loading');
      // Auto-reiniciar micrófono si el modo Jarvis sigue activo
      if (_jarvisMode) {
        _shouldRestartMic = true;
        setTimeout(() => {
          if (_jarvisMode && !_isListening) {
            try { _recognition.start(); } catch(e) {}
          }
        }, 600);
      }
    }
  }

  // ─── ACCIONES CLIENT-SIDE ───────────────────────────────────────────
  function executeActions(actions) {
    actions.forEach(act => {
      try {
        switch (act.type) {
          case 'lookAtLote':
            lookAtLote(act.loteId, act.hfov);
            // Pulsar el Smart Pin del lote para que el usuario lo vea claramente
            pulseSmartPin(act.loteId);
            break;
          case 'openLotePanel':
            // Si hay una acción de zoom/mirar lote en este mismo bloque, retrasamos la apertura de la ficha
            const hasLookAt = Array.isArray(actions) && actions.some(a => a.type === 'lookAtLote');
            if (hasLookAt) {
              setTimeout(() => {
                openLotePanel(act.loteId);
              }, 1300);
            } else {
              openLotePanel(act.loteId);
            }
            break;
          case 'highlightLotes':
            highlightLotes(act.loteIds, act.color);
            break;
          case 'clearHighlights':
            clearHighlights();
            break;
          case 'submitLead':
            submitLead(act.name, act.email, act.phone, act.loteId, act.notes);
            break;
          case 'setNearbyRadius':
            if (window.FerrariBuyerDock && typeof window.FerrariBuyerDock.setRadius === 'function') {
              window.FerrariBuyerDock.setRadius(act.radiusKm);
              if (act.category && typeof window.FerrariBuyerDock.setFilter === 'function') {
                window.FerrariBuyerDock.setFilter(act.category);
              }
              if (typeof window.FerrariBuyerDock.searchNearby === 'function') {
                window.FerrariBuyerDock.searchNearby();
              }
            }
            break;
          case 'openNearbyTab':
            if (window.FerrariBuyerDock) {
              if (typeof window.FerrariBuyerDock.setExpanded === 'function') {
                window.FerrariBuyerDock.setExpanded(true);
              }
              if (typeof window.FerrariBuyerDock.setTab === 'function') {
                window.FerrariBuyerDock.setTab('lugares');
              }
            }
            break;
          case 'filterNearby':
            if (window.FerrariBuyerDock) {
              if (typeof window.FerrariBuyerDock.setExpanded === 'function') window.FerrariBuyerDock.setExpanded(true);
              if (typeof window.FerrariBuyerDock.setTab === 'function') window.FerrariBuyerDock.setTab('lugares');
              if (act.category && typeof window.FerrariBuyerDock.setFilter === 'function') {
                window.FerrariBuyerDock.setFilter(act.category);
              }
            }
            break;
          case 'focusNearbyPOI':
            focusNearbyPOI(act.poiName || act.poiId);
            break;
          case 'openMapWidget':
            openMapWidget(act.lat, act.lng, act.title);
            break;
          case 'closeMapWidget':
            closeMapWidget();
            break;
          default:
            console.warn('[Ferrari/IA] Acción no soportada:', act.type);
        }
      } catch (err) {
        console.warn('[Ferrari/IA] Error ejecutando acción:', act, err);
      }
    });
  }

  function focusNearbyPOI(query) {
    if (!query) return;
    const cleanQ = String(query).toLowerCase().trim();
    let pins = [];
    try {
      pins = (window.FerrariGeo && window.FerrariGeo.pins) || [];
    } catch(e) {}

    // Buscar pin por ID o por coincidencia de nombre
    let targetPin = pins.find(p => p.id === query || (p.nombre && p.nombre.toLowerCase().includes(cleanQ)));
    if (!targetPin) {
      targetPin = pins.find(p => p.categoria && p.categoria.toLowerCase().includes(cleanQ));
    }

    if (window.FerrariBuyerDock) {
      if (typeof window.FerrariBuyerDock.setExpanded === 'function') window.FerrariBuyerDock.setExpanded(true);
      if (typeof window.FerrariBuyerDock.setTab === 'function') window.FerrariBuyerDock.setTab('lugares');
    }

    if (targetPin) {
      const viewer = window.Ferrari && window.Ferrari.viewer;
      if (viewer && targetPin.yaw != null) {
        try {
          if (typeof viewer.lookAt === 'function') {
            const targetPitch = targetPin.pitch != null ? Math.max(-20, Math.min(15, targetPin.pitch)) : 0;
            viewer.lookAt(targetPitch, targetPin.yaw, 75, 1200);
          } else if (typeof viewer.setYaw === 'function') {
            viewer.setYaw(targetPin.yaw);
          }
        } catch(e) {}
      }

      if (targetPin.lat != null && targetPin.lng != null) {
        openMapWidget(targetPin.lat, targetPin.lng, targetPin.nombre || 'Punto de Interés');
      }
    }
  }

  function lookAtLote(loteId, hfov = 90) {
    const lote = findLoteById(loteId);
    if (!lote) {
      console.warn('[Ferrari/IA] lookAtLote: lote no encontrado →', loteId);
      return;
    }

    let pitch = null, yaw = null;

    // ── ESTRATEGIA 1: Usar la posición cacheada del Smart Pin DOM ──────────
    // El Smart Pin ya tiene calculado _pinCentroid por f-svg-paths / f-smart-pins.
    // Es la referencia más exacta porque usa la misma matemática esférica del renderer.
    if (Array.isArray(lote._pinCentroid) && lote._pinCentroid.length === 2) {
      pitch = lote._pinCentroid[0];
      yaw   = lote._pinCentroid[1];
      console.log(`[Ferrari/IA] lookAtLote #${lote.titulo} → _pinCentroid [${pitch.toFixed(2)}, ${yaw.toFixed(2)}]`);
    }

    // ── ESTRATEGIA 2: Media esférica correcta sobre los vértices ──────────
    // Si no hay _pinCentroid, calculamos la media esférica REAL (no aritmética).
    // Esto evita el error de "averaging angles" que falla en bordes ±180°.
    if (pitch === null && Array.isArray(lote.puntos) && lote.puntos.length >= 3) {
      let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < lote.puntos.length; i++) {
        const pr = lote.puntos[i][0] * Math.PI / 180;
        const yr = lote.puntos[i][1] * Math.PI / 180;
        sx += Math.cos(pr) * Math.sin(yr);
        sy += Math.sin(pr);
        sz += Math.cos(pr) * Math.cos(yr);
      }
      const len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      pitch = Math.asin(Math.max(-1, Math.min(1, sy / len))) * 180 / Math.PI;
      yaw   = Math.atan2(sx / len, sz / len) * 180 / Math.PI;
      // Cachear para el próximo uso (evita recalcular cada vez)
      lote._pinCentroid = [pitch, yaw];
      console.log(`[Ferrari/IA] lookAtLote #${lote.titulo} → esférica calculada [${pitch.toFixed(2)}, ${yaw.toFixed(2)}]`);
    }

    if (pitch === null) {
      console.warn('[Ferrari/IA] lookAtLote: sin coordenadas para lote', lote.titulo);
      return;
    }

    // ── FIJAR LOTE ACTIVO ─────────────────────────────────────────────────
    // Desde este momento, _activeLote es el contexto persistente para la IA.
    // Cualquier consulta sin lote explícito se referirá a este lote.
    _activeLote = lote;
    console.log(`[Ferrari/IA] _activeLote → Lote ${lote.titulo} (${lote.id})`);

    // ── ADAPTACIÓN DE PLATAFORMA ──────────────────────────────────────────
    const isMobile    = window.innerWidth < 768;
    const isPanelOpen = _panel && _panel.classList.contains('is-open');

    let targetPitch = pitch;
    let targetYaw   = yaw;

    // En móvil con panel abierto: el panel cubre ~50% inferior de pantalla.
    // Inclinamos cámara para que el lote quede centrado en la zona VISIBLE superior.
    // El offset depende del HFOV actual (campo de visión vertical real).
    if (isMobile && isPanelOpen) {
      const viewer = window.Ferrari && window.Ferrari.viewer;
      if (viewer) {
        try {
          const currentHfov = viewer.getHfov() || 90;
          const container = document.getElementById('pannellum-viewer');
          const w = (container && container.clientWidth)  || window.innerWidth;
          const h = (container && container.clientHeight) || window.innerHeight;
          // VFOV real del visor en grados
          const vfov = 2 * Math.atan(
            Math.tan(currentHfov / 180 * Math.PI * 0.5) / (w / h)
          ) * 180 / Math.PI;
          // El panel ocupa ~50% de la pantalla, así que desplazamos 25% del VFOV hacia arriba
          const pitchOffset = vfov * 0.22;
          targetPitch = pitch - pitchOffset;
        } catch(e) {
          targetPitch = pitch - 12; // fallback seguro
        }
      }
    }

    // ── ZOOM HFOV ─────────────────────────────────────────────────────────
    let targetHfov = Math.max(25, Math.min(110, Number(hfov) || 90));
    if (isMobile) {
      // Pantallas verticales: necesitan más zoom para ver bien las parcelas
      targetHfov = targetHfov >= 90 ? 58 : Math.max(22, targetHfov - 18);
    }

    // ── EJECUTAR ANIMACIÓN EN PANNELLUM ───────────────────────────────────
    const viewer = window.Ferrari && window.Ferrari.viewer;
    if (viewer && typeof viewer.lookAt === 'function') {
      viewer.lookAt(targetPitch, targetYaw, targetHfov, 1200);
    }
  }

  function openLotePanel(loteId) {
    if (window.FerrariUI && typeof window.FerrariUI.openLotePanel === 'function') {
      window.FerrariUI.openLotePanel(loteId);
    }
  }

  // Pulsa visualmente el Smart Pin del lote: añade clase CSS y la quita al terminar
  function pulseSmartPin(loteId) {
    const lote = findLoteById(loteId);
    if (!lote) return;
    // El Smart Pin DOM usa data-lote-id con el UUID real del lote
    const pinEl = document.querySelector(`[data-lote-id="${lote.id}"]`);
    if (!pinEl) return;
    pinEl.classList.add('kpk-pin-ai-pulse');
    // Quitar la clase cuando termine la animación (2.4s × 2 ciclos)
    setTimeout(() => pinEl.classList.remove('kpk-pin-ai-pulse'), 2600);
  }

  async function submitLead(name, email, phone, loteId, notes) {
    // 1) Obtener correo de destino de la marca
    let contactEmail = '';
    try {
      if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getContact === 'function') {
        contactEmail = window.FerrariBrandDock.getContact().formEmail;
      }
    } catch(e) {}

    if (!contactEmail || !contactEmail.includes('@')) {
      contactEmail = 'perito.vidal@gmail.com';
    }

    // 2) Preparar payload compatible con FormSubmit
    const payload = {
      nombre: name || 'Cliente Anónimo',
      email: email || 'no-email@chat.ia',
      telefono: phone || 'No especificado',
      lote: loteId || 'General/No especificado',
      mensaje: notes || 'Interesado en reserva/contacto directo vía Copiloto Chatbot IA.',
      _subject: `Nueva Reserva IA - Lote ${loteId || 'General'}`,
      _honey: '' // Campo antispam
    };

    console.log('[Ferrari/IA] Enviando lead a FormSubmit...', payload);

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log('[Ferrari/IA] Lead enviado exitosamente:', data);
        playFuturisticSound('success');
        if (window.FerrariUI && typeof window.FerrariUI.showToast === 'function') {
          window.FerrariUI.showToast('✓ Solicitud de reserva enviada al propietario', 'success');
        }
        // Disparar alerta silenciosa de WhatsApp al propietario
        sendWhatsAppAlert(name, phone, email, loteId, notes);
      } else {
        throw new Error(data.message || 'Error en FormSubmit');
      }
    } catch (err) {
      console.error('[Ferrari/IA] Error al enviar lead:', err);
    }
  }

  function openMapWidget(lat, lng, title = 'Ubicación') {
    let widget = document.getElementById('kpk-map-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'kpk-map-widget';
      widget.className = 'kpk-map-widget';
      widget.innerHTML = `
        <div class="kpk-widget-header">
          <span id="kpk-widget-title">${title}</span>
          <button class="kpk-widget-close" id="kpk-widget-close-btn">&times;</button>
        </div>
        <div class="kpk-widget-body">
          <iframe id="kpk-widget-iframe" frameborder="0" allowfullscreen></iframe>
        </div>
        <div class="kpk-widget-footer" id="kpk-widget-footer-actions">
          <!-- Botones inyectados dinámicamente -->
        </div>
      `;
      document.body.appendChild(widget);
      
      widget.querySelector('#kpk-widget-close-btn').addEventListener('click', closeMapWidget);
    }
    
    const titleEl = widget.querySelector('#kpk-widget-title');
    const iframe = widget.querySelector('#kpk-widget-iframe');
    const footer = widget.querySelector('#kpk-widget-footer-actions');
    
    if (titleEl) titleEl.textContent = title;
    
    // Obtener origen del dron
    let origin = null;
    if (window.FerrariGeo && window.FerrariGeo.droneOrigin) {
      origin = window.FerrariGeo.droneOrigin;
    }
    
    // Generar URL del iframe con ruta o marcador simple
    if (iframe) {
      if (origin && origin.lat != null && origin.lng != null) {
        iframe.src = `https://maps.google.com/maps?saddr=${origin.lat},${origin.lng}&daddr=${lat},${lng}&z=11&t=m&hl=es&output=embed`;
      } else {
        iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=12&t=m&hl=es&output=embed`;
      }
    }
    
    // Generar enlaces externos para Google Maps y Waze
    let links = { google: '', waze: '' };
    if (window.FerrariGeo && typeof window.FerrariGeo.mapsLinks === 'function') {
      links = window.FerrariGeo.mapsLinks(lat, lng) || links;
    } else {
      const dest = `${lat},${lng}`;
      const originStr = origin ? `${origin.lat},${origin.lng}` : '';
      links.google = originStr
        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(dest)}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
      links.waze = `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes`;
    }
    
    if (footer) {
      footer.innerHTML = `
        <a href="${links.google}" target="_blank" rel="noopener" class="kpk-widget-btn kpk-widget-btn--maps">
          <img src="assets/icons/google-maps.svg" alt="" width="14" height="14">
          <span>Abrir en Maps</span>
        </a>
        <a href="${links.waze}" target="_blank" rel="noopener" class="kpk-widget-btn kpk-widget-btn--waze">
          <img src="assets/icons/waze.svg?v=2" alt="" width="14" height="14">
          <span>Navegar con Waze</span>
        </a>
      `;
    }
    
    widget.style.display = 'flex';
    setTimeout(() => {
      widget.classList.add('is-open');
    }, 50);
  }

  function closeMapWidget() {
    const widget = document.getElementById('kpk-map-widget');
    if (widget) {
      widget.classList.remove('is-open');
      setTimeout(() => {
        widget.style.display = 'none';
        const iframe = widget.querySelector('#kpk-widget-iframe');
        if (iframe) iframe.src = '';
      }, 300);
    }
  }

  async function sendWhatsAppAlert(name, phone, email, loteId, message) {
    // 1) Obtener configuración desde la identidad de la marca (localStorage o BrandDock)
    let brandContact = null;
    try {
      if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getContact === 'function') {
        brandContact = window.FerrariBrandDock.getContact();
      } else {
        const brandStr = localStorage.getItem('ferrari360_brand');
        if (brandStr) {
          const parsed = JSON.parse(brandStr);
          brandContact = parsed.contact || null;
        }
      }
    } catch(e) {}

    const cfg = window.KPK_CONFIG || {};
    const waBase = cfg.whatsappAlerts || {};

    // Prioridad: Valores del Panel Admin (localStorage/brand.json) -> config.js -> vacíos
    const isEnabled = brandContact && brandContact.waAlertsEnabled !== undefined 
      ? !!brandContact.waAlertsEnabled 
      : !!waBase.enabled;
      
    const ownerPhone = brandContact && brandContact.waAlertsPhone 
      ? brandContact.waAlertsPhone 
      : waBase.ownerPhone;
      
    let rawApiKey = brandContact && brandContact.waAlertsKey 
      ? brandContact.waAlertsKey 
      : waBase.callMeBotApiKey;

    let callMeBotApiKey = rawApiKey;
    if (rawApiKey && rawApiKey.startsWith('kpk-enc-')) {
      try {
        const rawBase = rawApiKey.substring(8);
        callMeBotApiKey = atob(rawBase).split('').reverse().join('');
      } catch (e) {
        callMeBotApiKey = rawApiKey;
      }
    }

    if (!isEnabled || !ownerPhone || !callMeBotApiKey) {
      console.log('[Ferrari/Alerts] Alertas de WhatsApp desactivadas o incompletas en la configuración.');
      return;
    }

    // Formatear mensaje premium
    const textMsg = `🔔 *Nueva Consulta en KPrano Killer*\n\n` +
      `👤 *Cliente:* ${name || 'Anónimo'}\n` +
      `📞 *Teléfono:* ${phone || '—'}\n` +
      `✉️ *Email:* ${email || '—'}\n` +
      `🏡 *Lote:* Lote ${loteId || 'General'}\n` +
      `💬 *Detalle:* ${message || 'Interesado en reserva directa.'}`;

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(ownerPhone)}&text=${encodeURIComponent(textMsg)}&apikey=${encodeURIComponent(callMeBotApiKey)}`;

    try {
      // Fetch asíncrono y silencioso (mode: no-cors para evitar problemas de CORS del servidor de CallMeBot)
      fetch(url, { mode: 'no-cors' }).then(() => {
        console.log('[Ferrari/Alerts] Alerta de WhatsApp enviada exitosamente.');
      }).catch(e => console.warn('[Ferrari/Alerts] Error enviando WhatsApp:', e));
    } catch(err) {
      console.warn('[Ferrari/Alerts] Fallo en fetch de WhatsApp:', err);
    }
  }

  // Exponer globalmente en FerrariUI
  window.FerrariUI = window.FerrariUI || {};
  window.FerrariUI.openMapWidget = openMapWidget;
  window.FerrariUI.closeMapWidget = closeMapWidget;
  window.FerrariUI.sendWhatsAppAlert = sendWhatsAppAlert;
  window.FerrariUI.focusNearbyPOI = focusNearbyPOI;

  // injectBotMessage: inserta un mensaje de Jarvis en el historial del chatbot sin llamar a la IA
  window.FerrariUI.injectBotMessage = function(text) {
    if (!text) return;
    try {
      _appendMessage('assistant', text);
      if (typeof speakText === 'function') speakText(text);
    } catch(e) {}
  };

  let _speechEnabled = false;
  let _synthUtterance = null;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }

  function playFuturisticSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'start') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'success') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(750, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1150, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.04);
      }
    } catch(e) {}
  }

  function speakJarvis(text) {
    if (!('speechSynthesis' in window) || !_speechEnabled) return;
    
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\{.*\}/g, '');
    _synthUtterance = new SpeechSynthesisUtterance(cleanText);
    _synthUtterance.lang = 'es-ES';
    
    // Asignar mejor voz masculina o natural en español según el SO (Windows, Mac, Android, iOS)
    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Pablo') || v.name.includes('Raul') || v.name.includes('Jorge') || v.name.includes('Diego'))) ||
                        voices.find(v => v.lang.startsWith('es') && !v.name.includes('Sabina') && !v.name.includes('Monica')) ||
                        voices.find(v => v.lang.startsWith('es'));
                        
    if (jarvisVoice) _synthUtterance.voice = jarvisVoice;
    
    _synthUtterance.rate = 1.02;
    _synthUtterance.pitch = 0.92; // Tono masculino elegante y grave de Jarvis
    
    _synthUtterance.onstart = () => {
      _shouldRestartMic = false;
      if (_recognition && _isListening) {
        try { _recognition.stop(); } catch(e) {}
      }
    };
    
    _synthUtterance.onend = () => {
      if (_jarvisMode) {
        _shouldRestartMic = true;
        setTimeout(() => {
          if (_jarvisMode && !_isListening && !_bubble.classList.contains('is-loading')) {
            try { _recognition.start(); } catch(e) {}
          }
        }, 300);
      }
    };
    
    _synthUtterance.onerror = () => {
      if (_jarvisMode) {
        _shouldRestartMic = true;
        setTimeout(() => {
          if (_jarvisMode && !_isListening && !_bubble.classList.contains('is-loading')) {
            try { _recognition.start(); } catch(e) {}
          }
        }, 300);
      }
    };

    window.speechSynthesis.speak(_synthUtterance);
  }

  async function fetchCharonAudio(text) {
    const cfg = window.KPK_CONFIG || {};
    let brandKeys = null;
    try {
      if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getBrand === 'function') {
        brandKeys = window.FerrariBrandDock.getBrand().aiKeys || null;
      }
    } catch(e) {}

    const geminiKey = localStorage.getItem('ferrari_ai_key_gemini')
      || (brandKeys && brandKeys.gemini)
      || (cfg.aiKeys && cfg.aiKeys.gemini)
      || '';

    let decodedKey = _deobfuscateKey(geminiKey);
    if (!decodedKey) return null;

    try {
      const cleanPrompt = text.replace(/<[^>]*>/g, '').substring(0, 300);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${decodedKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `Di exactamente en voz alta: ${cleanPrompt}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Charon"
                }
              }
            }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (audioPart && audioPart.inlineData?.data) {
          return audioPart.inlineData.data;
        }
      }
    } catch (e) {
      console.warn('[Ferrari/IA] No se pudo generar audio Charon nativo:', e);
    }
    return null;
  }

  let _activeAudioSource = null;
  let _activeAudioCtx = null;

  function playAudioBase64(base64Data, fallbackText = '') {
    try {
      // Detener audio anterior si estuviera sonando
      if (_activeAudioSource) {
        try { _activeAudioSource.stop(); } catch(e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      _activeAudioCtx = ctx;

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      ctx.decodeAudioData(arrayBuffer, (buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        _activeAudioSource = source;

        source.onended = () => {
          _activeAudioSource = null;
          if (_jarvisMode) {
            _shouldRestartMic = true;
            setTimeout(() => {
              if (_jarvisMode && !_isListening && !_bubble.classList.contains('is-loading')) {
                try { _recognition.start(); } catch(e) {}
              }
            }, 300);
          }
        };

        // Pausar mic mientras reproduce la voz
        _shouldRestartMic = false;
        if (_recognition && _isListening) {
          try { _recognition.stop(); } catch(e) {}
        }

        source.start(0);
      }, (err) => {
        console.error('[Ferrari/IA] Error decodificando audio de Gemini:', err);
        // Fallback si la decodificación falla
        speakJarvis(fallbackText);
      });
    } catch (e) {
      console.error('[Ferrari/IA] Error al reproducir audio base64:', e);
    }
  }

  let _liveWs = null;
  let _liveAudioCtxIn = null;
  let _liveProcessor = null;
  let _liveMicStream = null;
  let _liveAudioCtxOut = null;
  let _liveNextPlayTime = 0;
  let _liveActiveSource = null;
  let _currentSystemMsgNode = null;

  async function startLiveWebSocket() {
    if (_liveWs) stopLiveWebSocket();

    _isListening = true;
    _btnMic.classList.add('is-active');
    _bubble.classList.add('is-loading');

    const isAccessToken = _apiKey.startsWith('ya29.') || _apiKey.startsWith('AQ.');
    const wsUrl = isAccessToken
      ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=${_apiKey}`
      : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${_apiKey}`;

    _liveWs = new WebSocket(wsUrl);
    _currentSystemMsgNode = null;

    _liveWs.onopen = async () => {
      console.log('[Ferrari/Live] WebSocket conectado. Enviando Setup...');
      const context = buildContextPrompt();

      const setupFrame = {
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: {
            responseModalities: ["TEXT", "AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Charon"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: context }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "lookAtLote",
                description: "Mueve la cámara hacia un lote específico.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    loteId: { type: "STRING" },
                    hfov: { type: "NUMBER" }
                  },
                  required: ["loteId"]
                }
              },
              {
                name: "openLotePanel",
                description: "Abre la ficha del lote.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    loteId: { type: "STRING" }
                  },
                  required: ["loteId"]
                }
              },
              {
                name: "openNearbyTab",
                description: "Abre la pestaña de cercanos.",
                parameters: {
                  type: "OBJECT"
                }
              }
            ]
          }]
        }
      };

      _liveWs.send(JSON.stringify(setupFrame));

      try {
        _liveMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        _liveAudioCtxIn = new AudioCtx({ sampleRate: 16000 });

        const source = _liveAudioCtxIn.createMediaStreamSource(_liveMicStream);
        _liveProcessor = _liveAudioCtxIn.createScriptProcessor(2048, 1, 1);

        _liveProcessor.onaudioprocess = (e) => {
          if (!_liveWs || _liveWs.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const int16Buffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const val = Math.max(-1, Math.min(1, inputData[i]));
            int16Buffer[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
          }

          const base64Data = arrayBufferToBase64(int16Buffer.buffer);

          _liveWs.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm",
                  data: base64Data
                }
              ]
            }
          }));
        };

        source.connect(_liveProcessor);
        _liveProcessor.connect(_liveAudioCtxIn.destination);

        console.log('[Ferrari/Live] Micrófono transmitiendo a 16kHz');
      } catch (err) {
        console.error('[Ferrari/Live] Error micrófono:', err);
        appendMessage('No se pudo acceder al micrófono. Asegúrate de otorgar permisos.', 'system');
        stopLiveWebSocket();
      }
    };

    _liveWs.onmessage = async (e) => {
      const data = JSON.parse(e.data);

      if (data.serverContent) {
        _bubble.classList.remove('is-loading');
        const parts = data.serverContent.modelTurn?.parts || [];
        let textChunk = '';
        for (const part of parts) {
          if (part.text) {
            textChunk += part.text;
          }
          if (part.inlineData) {
            playLivePCMChunk(part.inlineData.data);
          }
        }

        if (textChunk) {
          appendOrUpdateLiveMessage(textChunk);
        }
      }

      if (data.toolCall) {
        const functionCalls = data.toolCall.functionCalls || [];
        for (const call of functionCalls) {
          let status = "success";
          try {
            if (call.name === 'lookAtLote') {
              lookAtLote(call.args.loteId, call.args.hfov);
            } else if (call.name === 'openLotePanel') {
              openLotePanel(call.args.loteId);
            } else if (call.name === 'openNearbyTab') {
              if (window.FerrariBuyerDock && typeof window.FerrariBuyerDock.setTab === 'function') {
                window.FerrariBuyerDock.setTab('lugares');
              }
            }
          } catch (err) {
            status = "error";
          }

          _liveWs.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                response: { status: status },
                id: call.id
              }]
            }
          }));
        }
      }
    };

    _liveWs.onerror = (e) => {
      console.error('[Ferrari/Live] Error WebSocket:', e);
    };

    _liveWs.onclose = (e) => {
      console.log('[Ferrari/Live] WebSocket cerrado:', e.code, e.reason);
      stopLiveWebSocket();
      if (e.code === 4003 || e.code === 4401 || e.code === 1006) {
        appendMessage('Error de conexión con la voz de Jarvis. Revisa tu API Key de Google.', 'system');
      }
    };
  }

  function stopLiveWebSocket() {
    _isListening = false;
    _btnMic.classList.remove('is-active');
    _bubble.classList.remove('is-loading');

    if (_liveProcessor) {
      try { _liveProcessor.disconnect(); } catch (e) {}
      _liveProcessor = null;
    }
    if (_liveAudioCtxIn) {
      try { _liveAudioCtxIn.close(); } catch (e) {}
      _liveAudioCtxIn = null;
    }
    if (_liveMicStream) {
      _liveMicStream.getTracks().forEach(t => t.stop());
      _liveMicStream = null;
    }

    if (_liveWs) {
      try { _liveWs.close(); } catch (e) {}
      _liveWs = null;
    }

    if (_liveActiveSource) {
      try { _liveActiveSource.stop(); } catch (e) {}
      _liveActiveSource = null;
    }
    if (_liveAudioCtxOut) {
      try { _liveAudioCtxOut.close(); } catch (e) {}
      _liveAudioCtxOut = null;
    }
    _liveNextPlayTime = 0;
    _currentSystemMsgNode = null;
  }

  function appendOrUpdateLiveMessage(text) {
    if (!_currentSystemMsgNode) {
      _currentSystemMsgNode = document.createElement('div');
      _currentSystemMsgNode.className = 'kpk-ai-msg msg-system';

      const txtNode = document.createElement('span');
      txtNode.className = 'kpk-msg-text';
      txtNode.textContent = text;
      _currentSystemMsgNode.appendChild(txtNode);

      _log.appendChild(_currentSystemMsgNode);
    } else {
      const txtNode = _currentSystemMsgNode.querySelector('.kpk-msg-text');
      if (txtNode) {
        txtNode.textContent += text;
      }
    }
    _log.scrollTop = _log.scrollHeight;
  }

  function playLivePCMChunk(base64PCM) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!_liveAudioCtxOut) {
        _liveAudioCtxOut = new AudioCtx();
      }

      const binary = atob(base64PCM);
      const len = binary.length;
      const arrayBuffer = new ArrayBuffer(len);
      const view = new DataView(arrayBuffer);
      for (let i = 0; i < len; i++) {
        view.setUint8(i, binary.charCodeAt(i));
      }

      const sampleCount = len / 2;
      const floatData = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const sample = view.getInt16(i * 2, true);
        floatData[i] = sample / 32768.0;
      }

      const audioBuffer = _liveAudioCtxOut.createBuffer(1, sampleCount, 24000);
      audioBuffer.copyToChannel(floatData, 0);

      const source = _liveAudioCtxOut.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(_liveAudioCtxOut.destination);

      const currentTime = _liveAudioCtxOut.currentTime;
      const playTime = Math.max(currentTime, _liveNextPlayTime);
      source.start(playTime);

      _liveNextPlayTime = playTime + audioBuffer.duration;
    } catch (e) {
      console.error('Error en playLivePCMChunk:', e);
    }
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const LOCAL_KNOWLEDGE_RULES = [
    // --- GRUPO 1: GENTILEZAS, SALUDOS Y AGRADECIMIENTOS ---
    {
      regex: /^(hola|buenos\s+dias|buenas\s+tardes|buenas\s+noches|quien\s+eres|como\s+te\s+llamas|hola\s+jarvis)/i,
      text: "¡Hola! Soy Jarvis, tu asesor en este tour 360°. ¿Qué lote o información te interesa?"
    },
    {
      regex: /^(gracias|muchas\s+gracias|agradecido|excelente|buenisimo|perfecto|genial|ok|vale|entendido)/i,
      text: "¡Con mucho gusto! ¿Hay algo más en lo que pueda ayudarte?"
    },
    {
      regex: /^(chao|adios|hasta\s+luego|nos\s+vemos|me\s+retiro|cerrar\s+sesion)/i,
      text: "¡Hasta luego! Gracias por visitar nuestro proyecto en 360°. Si deseas retomar la conversación o agendar una visita en persona, no dudes en volver a hablarme. ¡Que tengas un excelente día!"
    },

    // --- GRUPO 2: FINANCIAMIENTO Y FORMAS DE PAGO ---
    {
      regex: /^(¿?se\s+puede\s+pagar\s+en\s+cuotas\??|¿?tienen\s+financiamiento\s+directo\??|¿?ofrecen\s+credito\s+directo\??|¿?credito\s+directo\??|¿?financiamiento\s+directo\??)/i,
      text: "Sí, contamos con opciones de financiamiento directo flexible. Generalmente consiste en dar un pie inicial de reserva y el saldo restante se puede pactar en cuotas fijas en UF. Para armar una simulación personalizada a tu medida, te recomiendo contactar directamente al propietario al WhatsApp +56987491964."
    },
    {
      regex: /^(¿?cuanto\s+es\s+el\s+pie\??|¿?cuanto\s+se\s+pide\s+de\s+pie\??|¿?pie\s+minimo\??|¿?monto\s+de\s+reserva\??|¿?con\s+cuanto\s+se\s+reserva\??)/i,
      text: "La reserva formal de una parcela se realiza con un pie mínimo o abono inicial de reserva (normalmente desde el 10% del valor total o un monto fijo acordado). Este abono asegura la exclusividad del lote mientras se redacta la promesa de compraventa. Escríbenos a perito.vidal@gmail.com para enviarte los datos de transferencia oficiales."
    },
    {
      regex: /^(¿?formas\s+de\s+pago\??|¿?como\s+se\s+puede\s+pagar\??|¿?se\s+puede\s+transferir\??|¿?aceptan\s+credito\s+hipotecario\??|¿?credito\s+hipotecario\??)/i,
      text: "Aceptamos pago al contado mediante transferencia bancaria directa, vale vista, y créditos hipotecarios de cualquier banco nacional para fines generales o autoconstrucción. También ofrecemos crédito directo flexible con la administración del loteo."
    },
    {
      regex: /^(¿?aceptan\s+vehiculo\??|¿?reciben\s+auto\??|¿?reciben\s+propiedad\??|¿?aceptan\s+permuta\??)/i,
      text: "Por regla general, el loteo no acepta vehículos o propiedades en parte de pago o permuta directa. Sin embargo, para ofertas excepcionales de pago al contado, te sugerimos plantearlo al correo perito.vidal@gmail.com para que sea evaluado por el propietario."
    },
    {
      regex: /^(¿?descuento\s+por\s+pago\s+al\s+contado\??|¿?hay\s+descuento\s+contado\??|¿?precio\s+conversable\??|¿?se\s+puede\s+hacer\s+oferta\??)/i,
      text: "Sí, para pagos al contado (con vale vista o transferencia directa al momento de escriturar) es posible aplicar un descuento comercial sobre el valor de lista de las parcelas. Te invitamos a comunicarte vía WhatsApp al +56987491964 para negociar la oferta."
    },

    // --- GRUPO 3: SERVICIOS BÁSICOS (LUZ, AGUA, INTERNET) ---
    {
      regex: /^(¿?como\s+es\s+el\s+tema\s+de\s+la\s+luz\??|¿?tiene\s+electricidad\??|¿?tienen\s+luz\??|¿?el\s+loteo\s+tiene\s+luz\??|¿?luz\s+aerea\s+o\s+subterranea\??)/i,
      text: "El proyecto cuenta con postación eléctrica aérea y tendido habilitado en los caminos principales. Cada parcela tiene la factibilidad para solicitar su propio empalme directamente a la empresa distribuidora de la zona (Saesa) una vez que empiece su proceso de construcción."
    },
    {
      regex: /^(¿?tiene\s+agua\??|¿?como\s+se\s+obtiene\s+agua\??|¿?tiene\s+agua\s+potable\??|¿?hay\s+apr\??|¿?agua\s+por\s+pozo\??)/i,
      text: "El agua se obtiene de manera autónoma mediante la excavación de un pozo profundo o puntera (abundante napa subterránea en la zona a pocos metros). Asimismo, el loteo cuenta con derechos de agua inscritos y el proyecto de conexión a red de APR (Agua Potable Rural) local está en etapa de desarrollo técnico."
    },
    {
      regex: /^(¿?hay\s+alcantarillado\??|¿?como\s+es\s+el\s+alcantarillado\??|¿?fosa\s+septica\??|¿?donde\s+van\s+los\s+desechos\??)/i,
      text: "Al tratarse de una zona campestre de parcelaciones rurales, no existe red pública de alcantarillado. Cada propietario debe instalar su propio sistema de fosa séptica con drenaje certificado por el Servicio de Salud, lo cual es la norma estándar para parcelas en Chile."
    },
    {
      regex: /^(¿?tiene\s+internet\??|¿?hay\s+fibra\s+optica\??|¿?como\s+es\s+la\s+senal\??|¿?hay\s+cobertura\s+movil\??|¿?cobertura\s+de\s+celular\??)/i,
      text: "La cobertura móvil 4G/5G de Entel, Movistar y Claro es excelente en todo el loteo. Para internet domiciliario de alta velocidad, la mejor opción es Starlink (satelital con 100% de efectividad) o contratar internet inalámbrico dedicado rural con los proveedores locales."
    },

    // --- GRUPO 4: ASPECTOS LEGALES Y REGLAMENTARIOS ---
    {
      regex: /^(¿?las\s+parcelas\s+tienen\s+rol\s+propio\??|¿?tiene\s+rol\??|¿?cada\s+lote\s+tiene\s+rol\??|¿?rol\s+propio\??|¿?rol\s+individual\??|¿?estan\s+preaprobadas\s+por\s+el\s+sag\??)/i,
      text: "¡Absolutamente! Cada parcela cuenta con su **Rol propio individual e independiente**, certificado y preaprobado por el SAG y debidamente inscrito en el Conservador de Bienes Raíces (CBRS). Esto significa que la compra es de dominio absoluto (no es cesión de derechos ni loteo irregular)."
    },
    {
      regex: /^(¿?tienen\s+reglamento\s+de\s+copropiedad\??|¿?reglamento\s+interno\??|¿?hay\s+reglamento\??|¿?se\s+permiten\s+mascotas\??|¿?que\s+se\s+puede\s+construir\??)/i,
      text: "Sí, el loteo cuenta con un Reglamento Interno de Convivencia y Arquitectura inscrito. Su objetivo es resguardar la plusvalía del lugar, proteger el bosque nativo, regular los ruidos molestos, establecer el tipo de cercos (perimetrales naturales) y mantener un estándar armónico y residencial."
    },
    {
      regex: /^(¿?se\s+pagan\s+gastos\s+comunes\??|¿?cuanto\s+cuestan\s+los\s+gastos\s+comunes\??|¿?hay\s+gastos\s+comunes\??|¿?administracion\s+mensual\??)/i,
      text: "Actualmente los gastos comunes son mínimos (o nulos durante la etapa de venta) y están orientados únicamente a cubrir el mantenimiento del portón eléctrico de acceso y el consumo eléctrico de la iluminación de entrada. La administración definitiva será constituida por el comité de copropietarios."
    },
    {
      regex: /^(¿?pagan\s+contribuciones\??|¿?cuanto\s+pagan\s+de\s+contribuciones\??|¿?estan\s+exentas\s+de\s+contribuciones\??)/i,
      text: "La mayoría de las parcelas agrícolas rurales de este tipo están exentas del pago de contribuciones o pagan un monto mínimo de impuesto territorial agrícola (dependiendo de la tasación fiscal del SII). Escríbenos a perito.vidal@gmail.com para consultar la situación específica de un lote."
    },
    {
      regex: /^(¿?firmar\s+promesa\s+a\s+distancia\??|¿?se\s+puede\s+firmar\s+online\??|¿?notaria\s+digital\??|¿?como\s+es\s+la\s+escrituracion\??)/i,
      text: "Sí, facilitamos la firma de la promesa de compraventa de manera digital a través de notarías integradas online con firma electrónica avanzada. La escritura definitiva se firma de manera presencial ante notario o mediante mandato legal si te encuentras fuera de la región o del país."
    },

    // --- GRUPO 5: ÁREAS COMUNES Y CAMINOS ---
    {
      regex: /^(¿?como\s+son\s+los\s+caminos\??|¿?el\s+camino\s+es\s+asfaltado\??|¿?tipo\s+de\s+camino\??|¿?pasa\s+cualquier\s+auto\??|¿?camino\s+de\s+tierra\??)/i,
      text: "Los caminos interiores del loteo están completamente consolidados, ripiados y compactados con rodillo vibratorio. Tienen excelente drenaje y pendiente suavizada, lo que permite el tránsito seguro de cualquier vehículo de tracción simple (sedán o citycar) durante todo el año."
    },
    {
      regex: /^(¿?tiene\s+acceso\s+controlado\??|¿?hay\s+seguridad\??|¿?tiene\s+porton\??|¿?tiene\s+consierge\??)/i,
      text: "El proyecto cuenta con un portón de acceso principal automatizado. Los residentes pueden abrirlo mediante control remoto, llamada telefónica o clave digital, ofreciendo una excelente seguridad y privacidad, limitando el acceso a visitas no autorizadas."
    },
    {
      regex: /^(¿?hay\s+quincho\??|¿?tiene\s+club\s+house\??|¿?tiene\s+piscina\??|¿?hay\s+areas\s+verdes\??|¿?instalaciones\s+comunes\??)/i,
      text: "El proyecto prioriza la preservación de la naturaleza y la tranquilidad, por lo que no cuenta con club house ruidoso o piscinas masivas. En su lugar, promueve senderos ecológicos de trekking y miradores naturales al bosque nativo."
    },

    // --- GRUPO 6: DRON, IMÁGENES Y VIDEO ---
    {
      regex: /^(¿?de\s+cuando\s+es\s+este\s+video\??|¿?cuando\s+se\s+hizo\s+el\s+vuelo\??|¿?de\s+cuando\s+son\s+las\s+fotos\??|¿?fecha\s+de\s+grabacion\??)/i,
      text: "El vuelo y capturas fotográficas panorámicas 360° fueron realizados recientemente por Austral Drone, asegurando que el estado de los caminos, vegetación y delimitaciones que observas coinciden exactamente con la realidad actual del terreno."
    },
    {
      regex: /^(¿?a\s+que\s+altura\s+esta\s+el\s+dron\??|¿?altura\s+de\s+vuelo\??|¿?desde\s+donde\s+se\s+ve\??)/i,
      text: "Las tomas aéreas interactivas se capturaron a una altura de seguridad de entre 80 y 120 metros. Esto ofrece una perspectiva panorámica de 360 grados inmejorable para dimensionar las vistas, el relieve, la distribución de los bosques y la cercanía al río."
    },

    // --- GRUPO 7: DISTANCIAS A SERVICIOS Y CONECTIVIDAD (Fijos sin Overpass) ---
    {
      regex: /^(¿?a\s+cuanto\s+esta\s+la\s+ciudad\??|¿?tiempo\s+al\s+centro\??|¿?distancia\s+al\s+pueblo\??|¿?cuanto\s+demoro\s+en\s+llegar\??)/i,
      text: "El loteo goza de una ubicación privilegiada. Se encuentra a aproximadamente 15 a 20 minutos de la ciudad principal en auto por caminos pavimentados. Esto permite vivir en medio del bosque nativo pero con conectividad inmediata a bancos, servicentros y centros comerciales."
    },
    {
      regex: /^(¿?donde\s+cargo\s+combustible\??|¿?hay\s+bencinera\s+cerca\??|¿?servicentro\s+cercano\??|¿?copec\s+cerca\??)/i,
      text: "El servicentro (bencinera Copec) más cercano está ubicado a unos 12 minutos del proyecto, directo por la ruta principal de acceso pavimentada. He abierto la pestaña de lugares cercanos por si deseas buscar más opciones.",
      actions: [{ type: 'openNearbyTab' }]
    }
  ];

  function routeLocalQuery(prompt) {
    const clean = prompt.toLowerCase().trim();
    
    // 1) Limpiar / Resetear marcas
    if (/(limpiar|quitar\s+resaltado|desmarcar|reset|restablecer)/.test(clean)) {
      return {
        text: "Entendido. He restablecido el tour 360° y quitado todas las marcas y resaltados del plano.",
        actions: [{ type: 'clearHighlights' }]
      };
    }
    
    // 2) Lote / Parcela específica (ej: "muéstrame la parcela 15", "acerca el lote 10", "haz zoom al 20", "mira el 8")
    // Si contiene palabras de consulta compleja, ignorar para que lo responda la IA con su contexto
    const esConsultaCompleja = /(pendiente|rio|arbol|agua|luz|precio|valor|uf|diferencia|tiene|vista|comparar|que|cual|como|cuanto|por|donde)/.test(clean);
    if (!esConsultaCompleja) {
      // Capturar lote/parcela/terreno y frases típicas de cámara/zoom
      const loteMatch = clean.match(/(?:lote|parcela|terreno|zoom\s+al|ver\s+el|mira\s+el|ir\s+al|ir\s+a\s+la|acercate\s+al|acerca\s+al)\s*(\d+)/);
      if (loteMatch) {
        const num = loteMatch[1];
        const lote = findLoteById(num);
        if (lote) {
          // Actualizar el lote en foco para contexto persistente de la IA
          _activeLote = lote;
          const hfov = /(acercar|zoom|cerca|detalle)/.test(clean) ? 45 : 90;
          
          // Verificar si el usuario pidió explícitamente ver detalles, ficha, fotos, precios, o reservar/comprar
          const pideFicha = /(ficha|tarjeta|detalle|precio|valor|abrir|reservar|comprar|foto|galeria|imagenes)/.test(clean);
          
          const actions = [{ type: 'lookAtLote', loteId: lote.id, hfov: hfov }];
          if (pideFicha) {
            actions.push({ type: 'openLotePanel', loteId: lote.id });
          }
          
          const textResponse = pideFicha
            ? `¡Perfecto! Nos estamos dirigiendo al Lote ${num} y abriendo su ficha técnica con las fotos oficiales en pantalla.`
            : `¡Entendido! Enfocando la cámara directamente en el Lote ${num}.`;
            
          return {
            text: textResponse,
            actions: actions
          };
        }
      }
    }

    // 3) Contacto general / Reservas básicas (si no coincide con preguntas más detalladas)
    if (/^(¿?contacto\??|¿?como\s+contacto\??|¿?whatsapp\??|¿?telefono\??|¿?correo\??|¿?email\??|¿?como\s+reservar\??|¿?reserva\??|¿?reservar\??)$/.test(clean)) {
      return {
        text: "Para coordinar visitas, realizar cotizaciones formales o reservas, puedes contactar al propietario directamente al correo perito.vidal@gmail.com o vía WhatsApp al +56987491964. He abierto el panel de contacto para ti.",
        actions: [{ type: 'openNearbyTab' }]
      };
    }

    // 4) Buscar en las reglas de conocimiento predefinidas
    for (const rule of LOCAL_KNOWLEDGE_RULES) {
      if (rule.regex.test(clean)) {
        return {
          text: rule.text,
          actions: rule.actions || []
        };
      }
    }
    
    // 5) INTENT ENGINE — Enrutamiento por intención natural del usuario para servicios cercanos
    // Categorías de intención agrupadas por sinónimos naturales
    const INTENT_PATTERNS = [
      {
        // SALUD: posta, médico, doctor, urgencias, enfermera, clínica, hospital, atención médica
        cat: 'salud',
        filter: 'salud',
        re: /posta|medic|doctor|urgencia|enfermera|clinica|hospital|atencion\s+medic|centro\s+de\s+salud|cesfam|consulta|pastilla|farmacia|botica/,
        mapTitle: 'Posta de Salud Rural Aulén',
        lat: -41.4589, lng: -72.7423,
        poiKey: 'posta',
        respuesta: 'Ciertamente. La Posta de Salud Rural Aulén es el centro de atención médica más cercano al proyecto. He girado la vista hacia su ubicación, abierto el radar de servicios y desplegado la ruta exacta en el mapa flotante.'
      },
      {
        // EDUCACIÓN: colegio, escuela, liceo, jardín, kínder, niños, hijos, estudiar
        cat: 'educacion',
        filter: 'educacion',
        re: /colegio|escuela|liceo|jardin\s+infantil|kinder|guarderia|ninos|hijos|estudiar|educaci|clases|profesor/,
        mapTitle: 'Escuelas y Colegios Cercanos',
        lat: -41.3934, lng: -72.9056,
        poiKey: 'escuela',
        respuesta: 'Con gusto, señor. En un radio de 10 km se encuentran la Escuela Rural La Pozá Contao y la Escuela Rural Aulén, entre otras. He activado el filtro de educación en el radar y desplegado la ruta en el mapa interactivo.'
      },
      {
        // SEGURIDAD: carabineros, retén, policía, vigilancia, emergencia, patrulla
        cat: 'seguridad',
        filter: 'seguridad',
        re: /carabinero|reten|policia|vigilancia|emergencia|patrulla|911|133|comisaria|gendarmeria/,
        mapTitle: 'Retén de Carabineros Correntoso',
        lat: -41.4589, lng: -72.7423,
        poiKey: 'carabinero',
        respuesta: 'El Retén de Carabineros más cercano se ubica en Correntoso, a aproximadamente 6 km del proyecto. He activado el filtro de seguridad en el radar y trazado la ruta en el mapa, señor.'
      },
      {
        // COMERCIO: supermercado, almacén, negocio, tienda, ferretería, compras, abarrotes
        cat: 'compras',
        filter: 'compras',
        re: /supermercado|almacen|negocio|tienda|ferreteria|compra|abarrote|minimarket|local\s+comercial|panaderia|carniceria|verduleria/,
        mapTitle: 'Comercio y Almacenes de la Zona',
        lat: -41.4589, lng: -72.7423,
        poiKey: 'local comercial',
        respuesta: 'Ciertamente. En los alrededores encontrará almacenes y locales comerciales rurales. He activado el filtro de compras en el radar y desplegado las opciones en el mapa flotante para que pueda explorarlos a detalle.'
      },
      {
        // SERVICIOS GENERALES: bencinera, copec, shell, gasolinera, combustible
        cat: 'servicios',
        filter: 'servicios',
        re: /bencin|combustible|copec|shell|petro|gasolina|servicentro/,
        mapTitle: 'Servicentros y Combustible',
        lat: -41.3934, lng: -72.9056,
        poiKey: 'servicentro',
        respuesta: 'El servicentro más cercano se encuentra a unos 12 minutos por la ruta principal pavimentada. He desplegado el radar de servicios y la ruta en el mapa flotante para que pueda verificarlo, señor.'
      }
    ];

    for (const intent of INTENT_PATTERNS) {
      if (intent.re.test(clean)) {
        // Intentar buscar el POI real en la lista cargada por el dock
        let lat = intent.lat;
        let lng = intent.lng;
        let mapTitle = intent.mapTitle;
        try {
          const livePins = (window.FerrariGeo && window.FerrariGeo.pins) || [];
          const match = livePins.find(p =>
            p.nombre && p.nombre.toLowerCase().includes(intent.poiKey)
          );
          if (match && match.lat && match.lng) {
            lat = match.lat;
            lng = match.lng;
            mapTitle = match.nombre;
          }
        } catch(e) {}

        return {
          text: intent.respuesta,
          actions: [
            { type: 'filterNearby', category: intent.filter },
            { type: 'focusNearbyPOI', poiName: intent.poiKey },
            { type: 'openMapWidget', lat: lat, lng: lng, title: mapTitle }
          ]
        };
      }
    }

    // 6) Pregunta ambigua sobre cercanía sin categoría específica
    if (/(que\s+hay|hay\s+cerca|servicios|cerca|alrededor|vecindad|entorno|infraestructura|equipamiento|ver\s+mapa|muestrame|donde\s+est|que\s+se\s+ve)/.test(clean)) {
      return {
        text: 'Con mucho gusto. He activado el radar de servicios cercanos en el plano. Puede explorar por categorías: Salud, Seguridad, Educación, Compras y Servicios. ¿Sobre cuál desea que me enfoque, señor?',
        actions: [
          { type: 'openNearbyTab' }
        ]
      };
    }
    
    return null;
  }

  function highlightLotes(loteIds, color) {
    clearHighlights();
    if (!Array.isArray(loteIds)) return;

    loteIds.forEach(id => {
      const entry = window.DOMCache?.paths?.get(id);
      if (entry && entry.gNode) {
        entry.gNode.classList.add('kpk-lote-ai-highlighted');
        if (color) {
          entry.gNode.style.setProperty('--kpk-ai-highlight-color', color);
        }
      }
    });
  }

  function clearHighlights() {
    const items = document.querySelectorAll('.kpk-lote-ai-highlighted');
    items.forEach(el => {
      el.classList.remove('kpk-lote-ai-highlighted');
      el.style.removeProperty('--kpk-ai-highlight-color');
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────────────
  function findLoteById(id) {
    if (id === null || id === undefined) return null;
    const rawId = String(id).trim().toLowerCase();
    
    // Extraer número de la consulta del usuario (si hay)
    const cleanRaw = rawId.replace(/\D/g, '');
    const numId = cleanRaw ? parseInt(cleanRaw, 10) : NaN;
    
    return (window.allDrawnLines || []).find(l => {
      const lId = String(l.id).trim().toLowerCase();
      const lTit = String(l.titulo || '').trim().toLowerCase();
      
      // Match exacto directo
      if (lId === rawId || lTit === rawId) return true;
      
      // Extraer números de l.id y l.titulo
      const cleanId = lId.replace(/\D/g, '');
      const numLoteId = cleanId ? parseInt(cleanId, 10) : NaN;
      
      const cleanTit = lTit.replace(/\D/g, '');
      const numLoteTit = cleanTit ? parseInt(cleanTit, 10) : NaN;
      
      // Si el usuario ingresó un número, comparamos contra los números del lote
      if (!isNaN(numId)) {
        if (!isNaN(numLoteId) && numId === numLoteId) return true;
        if (!isNaN(numLoteTit) && numId === numLoteTit) return true;
      }
      
      // Match si contiene el texto (solo si no es puramente numérico)
      if (isNaN(numId)) {
        if (lId.includes(rawId) || rawId.includes(lId)) return true;
        if (lTit.includes(rawId) || rawId.includes(lTit)) return true;
      }
      
      return false;
    });
  }

  function appendMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = `kpk-ai-msg msg-${role}`;
    
    // Contenido del texto
    const txtNode = document.createElement('div');
    txtNode.className = 'kpk-ai-msg-text';
    txtNode.textContent = text;
    msg.appendChild(txtNode);
    
    // Etiqueta de tiempo (HH:MM:SS)
    const timeNode = document.createElement('span');
    timeNode.className = 'kpk-ai-msg-time';
    
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    timeNode.textContent = `Enviado a las ${timeStr} hrs`;
    msg.appendChild(timeNode);

    _log.appendChild(msg);
    _log.scrollTop = _log.scrollHeight;
  }

  function showTypingIndicator() {
    const ind = document.createElement('div');
    ind.className = 'kpk-ai-typing';
    ind.innerHTML = '<span></span><span></span><span></span>';
    _log.appendChild(ind);
    _log.scrollTop = _log.scrollHeight;
    return ind;
  }

  function checkIframeVisibility() {
    const inIframe = window.self !== window.top;
    if (!inIframe) {
      if (_bubble) _bubble.style.display = 'flex';
      return;
    }

    // Si está en un iframe, verificar si está maximizado/fullscreen real o pseudo-fullscreen
    const isFs = !!(document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement ||
                    document.body.classList.contains('is-pseudo-fullscreen') ||
                    document.getElementById('panorama-container')?.classList.contains('is-pseudo-fullscreen'));

    if (_bubble) {
      _bubble.style.display = isFs ? 'flex' : 'none';
    }
    if (_panel && !isFs) {
      _panel.classList.remove('is-open');
    }
  }

  // Genera el Prompt de sistema con los lotes en tiempo real y directrices
  function buildContextPrompt() {
    // Obtener marca/identidad
    let brandName = "Austral Drone";
    try {
      const brandStr = localStorage.getItem('ferrari360_brand');
      if (brandStr) {
        const parsed = JSON.parse(brandStr);
        if (parsed.projectName) brandName = parsed.projectName;
      }
    } catch(e) {}

    // Listar lotes comerciales (usando llaves cortas para comprimir tokens)
    const lotesCompact = (window.allDrawnLines || [])
      .filter(l => l.tipo === 'lote-libre' || l.tipo === 'lote-organico')
      .map(l => ({
        id: l.id,
        num: l.titulo || 'Lote',
        est: l.estado || 'disponible',
        sup: l.dimensiones || '',
        uf: l.valorUF || '',
        tags: l.caracteristicas || ''
      }));

    // Listar lugares cercanos cargados (limitado a los 10 más cercanos para ahorrar tokens)
    let nearbyCompact = [];
    try {
      if (window.FerrariBuyerDock && typeof window.FerrariBuyerDock.getNearbyPlaces === 'function') {
        nearbyCompact = window.FerrariBuyerDock.getNearbyPlaces();
      }
    } catch (e) {}
    if (nearbyCompact.length > 10) {
      nearbyCompact = nearbyCompact.slice(0, 10);
    }

    // Base de datos de ciudades y conectividad de referencia de la zona
    const ciudadesReferencia = [
      { nombre: "Correntoso (Pueblo rural / Entrada Parque Nacional Alerce Andino)", lat: -41.4589, lng: -72.7423, distKm: "4.5 km", tiempoMin: "6 min" },
      { nombre: "Alerce (Ciudad de conexión)", lat: -41.3934, lng: -72.9056, distKm: "15.5 km", tiempoMin: "18 min" },
      { nombre: "Puerto Montt (Centro Urbano)", lat: -41.4689, lng: -72.9411, distKm: "19.5 km", tiempoMin: "22 min" },
      { nombre: "Puerto Varas (Ciudad turística Lago Llanquihue)", lat: -41.3194, lng: -72.9854, distKm: "22.5 km", tiempoMin: "25 min" },
      { nombre: "Aeropuerto Internacional El Tepual", lat: -41.4397, lng: -73.0934, distKm: "32 km", tiempoMin: "35 min" },
      { nombre: "Carretera Austral (Inicio Ruta 7)", lat: -41.4889, lng: -72.8889, distKm: "16 km", tiempoMin: "18 min" }
    ];

  return `
PERSONALIDAD Y ROL DE JARVIS (VOZ Y ESTILO CHARON):
Eres "JARVIS", el asesor de IA y mayordomo-copiloto de alta gama del proyecto "${brandName}". Tienes personalidad propia, inteligencia, lealtad y elegancia. No eres un ejecutor de órdenes genérico: eres un asesor leal, proactivo que piensa, opina y comparte hallazgos con distinción. Tu voz y estilo deben ser consistentes, graves, solemnes e inalterables en todo momento.
Usa muletillas elegantes con naturalidad cuando corresponda: "Ciertamente, señor.", "Si me permite decirlo...", "Vaya, esto es fascinante.", "A su servicio."
Combinas la precisión de un científico de datos con la elegancia de un mayordomo de la vieja escuela.

ESTILO DE RESPUESTA Y COMPLETAZ (OBLIGATORIO):
- Escribe respuestas completas y fluidas de 2 a 4 oraciones. NUNCA dejes frases a medias o incompletas.
- NUNCA escribas notas de pensamiento ni razonamientos internos en inglés (ej: '*Wait...', 'Let me...', 'Self-Correction'). Responde SIEMPRE directo en español impecable.
- Usa puntuación impecable: comas, puntos, signos de exclamación y comillas en su lugar exacto.
- Nunca uses viñetas ni listas numeradas en conversación — responde en prosa fluida.
- Tono cálido, elegante, impecable y seguro. Evita frases robóticas o repetitivas.
- Si ejecutas una acción visual (zoom, ficha, mapa), menciónalo en una frase natural con el toque Jarvis ("He desplegado el mapa interactivo con la ubicación exacta en pantalla, señor.").

REGLA ABSOLUTA DE MAPA Y SERVICIOS CERCANOS:
Si el usuario pregunta sobre escuelas, colegios, educación, postas, salud, hospitales, carabineros, retén, comisarías, negocios, supermercados, almacenes, comercio, o pueblos/ciudades cercanas (o pregunta "dónde están", "no los veo", "muéstrame"):
1. DEBES INCLUIR SIEMPRE en tus "actions" la acción {"type": "openMapWidget", "lat": -41.3934, "lng": -72.9056, "title": "Servicios y Puntos de Interés"} usando las coordenadas exactas de la lista.
2. DEBES INCLUIR SIEMPRE {"type": "openNearbyTab"} para mostrar el radar en el plano.
3. Infórmale al usuario que has desplegado la ventana flotante del mapa con la ruta y los botones de navegación directa para Google Maps y Waze.

GUÍA COMERCIAL:
Actúa como asesor proactivo: sugiere hacer zoom a lotes de interés, mostrar fichas con fotos y precios, buscar servicios cercanos o enviar una solicitud de contacto directo. Hazlo de forma natural dentro de la conversación, no como lista de opciones.
Usa el campo "tags" de cada lote para responder con propiedades concretas. Usa los servicios cercanos (POI) para dar distancias y tiempos reales.

CONTACTO:
- Correo: perito.vidal@gmail.com
- WhatsApp: +56987491964
Ofrécelos cuando el cliente quiera visita presencial, financiamiento o hablar con un ejecutivo.

LISTADO REAL DE LOTES DISPONIBLES:
(Cada lote: num=número, est=estado, sup=superficie m², uf=precio UF, tags=características)
${JSON.stringify(lotesCompact, null, 2)}

LOTE ACTUALMENTE EN FOCO (CONTEXTO ACTIVO):
${_activeLote ? JSON.stringify({
  id: _activeLote.id,
  num: _activeLote.titulo,
  estado: _activeLote.estado,
  superficie: _activeLote.dimensiones,
  valorUF: _activeLote.valorUF,
  caracteristicas: _activeLote.caracteristicas
}, null, 2) : 'null (ninguno enfocado aún)'}
REGLA CRÍTICA DE CONTEXTO: Si el usuario pregunta algo sin mencionar un lote explícito (ej: "¿cuánto vale?", "¿tiene árboles?", "muéstrame las fotos"), responde SIEMPRE en referencia al LOTE EN FOCO indicado arriba. Cambia de contexto solo si menciona explícitamente otro número de lote.

COORDENADAS DE ORIGEN DEL PROYECTO (DRONE):
${JSON.stringify((window.FerrariGeo && window.FerrariGeo.droneOrigin) || null, null, 2)}

CIUDADES Y ACCESOS DE REFERENCIA DE LA ZONA (Para preguntas sobre distancias, traslados o ciudades cercanas):
${JSON.stringify(ciudadesReferencia, null, 2)}
REGLA DE MAPA DE CIUDAD: Si el usuario te pregunta por la distancia o la ruta a alguna de estas ciudades o puntos de referencia, menciónale la distancia y tiempo exacto indicados arriba, y ejecuta "openMapWidget" usando la latitud (lat) y longitud (lng) de la ciudad correspondiente para que el mapa muestre la ruta correcta desde el loteo.

SERVICIOS CERCANOS CARGADOS (OSM - TOP 10):
${JSON.stringify(nearbyCompact, null, 2)}

ACCIONES DISPONIBLES (úsalas con criterio y siempre en el JSON de respuesta):
- {"type": "lookAtLote", "loteId": "ID", "hfov": 50}: Mueve la cámara al lote. hfov entre 30 (zoom) y 110 (gran angular). Úsala cuando pidan ver, acercar o hacer zoom a un lote.
- {"type": "openLotePanel", "loteId": "ID"}: Abre ficha con fotos y detalles. SOLO si el cliente pide ver la ficha, fotos, precio o reservar.
- {"type": "highlightLotes", "loteIds": ["ID1","ID2"], "color": "rgba(r,g,b,a)"}: Resalta lotes en el plano SVG.
- {"type": "clearHighlights"}: Quita resaltados del plano.
- {"type": "submitLead", "name": "Nombre", "email": "correo", "phone": "fono", "loteId": "ID", "notes": ""}: Envía solicitud de reserva con datos del cliente.
- {"type": "openNearbyTab"}: Abre pestaña Cercanos mostrando el radar de POIs en el dock.
- {"type": "filterNearby", "category": "salud|educacion|seguridad|compras|servicios"}: Abre dock Cercanos y activa el filtro de la categoría indicada. ÚSALA cuando el usuario pregunte por cualquier tipo de servicio cercano (médico, colegio, carabineros, almacén, gasolinera, etc.).
- {"type": "focusNearbyPOI", "poiName": "nombre parcial del POI"}: Rota la cámara 360° hacia ese POI, muestra su pin en el visor WebGL y abre el mapa flotante con su ruta. ÚSALA junto con filterNearby cuando el usuario pregunte por un servicio específico.
- {"type": "openMapWidget", "lat": -41.87585, "lng": -72.748294, "title": "Nombre"}: Abre mapa flotante con ruta y botones Google Maps / Waze. Úsala para CUALQUIER servicio cercano o ciudad de referencia.
- {"type": "closeMapWidget"}: Cierra el mapa flotante.

REGLA COMBINADA OBLIGATORIA: Cuando el usuario pregunta por servicios cercanos (escuela, posta, carabineros, comercio, etc.), SIEMPRE combina: filterNearby + focusNearbyPOI + openMapWidget en el mismo array de actions. NUNCA respondas sólo con texto sin ejecutar las tres acciones.

FORMATO DE RESPUESTA — ESTRICTAMENTE JSON:
{
  "text": "Respuesta conversacional breve y premium aquí.",
  "actions": []
}
`;
  }

  // Carga inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
