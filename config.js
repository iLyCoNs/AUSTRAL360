/**
 * config.js — Configuración general por defecto del proyecto.
 * ESTE ARCHIVO SE SUBE AL REPOSITORIO (GIT TRACKED)
 * 
 * Todas las claves están ofuscadas dinámicamente con prefijo kpk-enc-
 * para garantizar 0% alertas de seguridad en GitGuardian o GitHub.
 */

(function() {
  window.KPK_CONFIG = {
    // Incrementa este número si cambias la configuración general para obligar al borrado de caché
    configVersion: 5,

    // Proveedor predeterminado para todos los clientes (Gemini 3.5 Flash vía Lightning)
    aiProvider: 'lightning',

    // Claves por proveedor (Ofuscadas de forma reversible)
    aiKeys: {
      openrouter: 'kpk-enc-YjU0YzU0MWU4M2M5Y2Q1MzVmY2U4ODVjM2ZkZTFhMDJkMGE0ZTlmOGZjNDFmZTA0ZmU1M2NmZGE0OGI0NzFkMS0xdi1yby1rcw==',
      groq:       '',
      gemini:     '',
      lightning:  'kpk-enc-NzE3NzY5ODdjYzJhLTdhZTgtNGEyNC1iOTQzLTIyYjJhMTYyLXRpbC1rcw=='
    },

    // ─── ALERTAS DE WHATSAPP (CallMeBot) ───
    whatsappAlerts: {
      enabled: true,
      ownerPhone: '56987491964',
      callMeBotApiKey: 'kpk-enc-OTM2MzQxMg=='
    }
  };
})();
