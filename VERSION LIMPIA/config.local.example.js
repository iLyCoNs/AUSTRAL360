/**
 * config.local.example.js — PLANTILLA de configuración (SÍ se sube al repo)
 *
 * Para usar:
 *   cp config.local.example.js config.local.js
 *   → Edita config.local.js con tus keys reales
 *   → config.local.js está en .gitignore (nunca se sube)
 */
window.KPK_CONFIG = {
  aiProvider: 'openrouter',
  aiKeys: {
    openrouter: 'sk-or-v1-TU_KEY_AQUI',
    groq:       '',
    gemini:     ''
  }
};
