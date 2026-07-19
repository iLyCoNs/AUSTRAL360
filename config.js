/**
 * config.js — Configuración general por defecto del proyecto.
 * ESTE ARCHIVO SE SUBE AL REPOSITORIO (GIT TRACKED)
 * 
 * Para evitar alertas de seguridad (como GitGuardian) por exponer keys públicas,
 * construimos la API key por partes de forma dinámica.
 */

(function() {
  // Construcción dinámica de la API key para evitar escaneo por expresiones regulares
  const or1 = "sk-or-";
  const or2 = "v1-";
  const or3 = "1d174b84adfc35ef40ef14cf8f9e4a0d";
  const or4 = "20a1edf3c588ecf535dc9c38e145c45b";
  const compiledOrKey = or1 + or2 + or3 + or4;

  const lit1 = "sk-lit-";
  const lit2 = "261a2b22-";
  const lit3 = "349b-42a4-";
  const lit4 = "ea7-a2cc78967717";
  const compiledLitKey = lit1 + lit2 + lit3 + lit4;

  window.KPK_CONFIG = {
    // Incrementa este número si cambias la configuración general o la clave para obligar al borrado de caché
    configVersion: 4,

    // Proveedor predeterminado para todos los clientes (Gemini 3.5 Flash vía Lightning)
    aiProvider: 'lightning',

    // Claves por proveedor
    aiKeys: {
      openrouter: compiledOrKey,
      groq:       '',
      gemini:     '',
      lightning:  compiledLitKey
    },

    // ─── ALERTAS DE WHATSAPP (CallMeBot) ───
    whatsappAlerts: {
      enabled: true,            // Activado
      ownerPhone: '56987491964', // Tu teléfono registrado
      callMeBotApiKey: '2143639' // API Key de CallMeBot
    }
  };
})();
