// Simulación del motor de f-copilot.js
const fs = require('fs');
const path = require('path');

// 1. Cargar config.local.js si existe, de lo contrario config.js
let kpkConfig = null;
const localConfigPath = path.join(__dirname, '../config.local.js');
const defaultConfigPath = path.join(__dirname, '../config.js');

function mockWindow() {
  global.window = {
    location: { origin: 'http://localhost' }
  };
  
  if (fs.existsSync(localConfigPath)) {
    console.log('Cargando config.local.js (Local)...');
    const content = fs.readFileSync(localConfigPath, 'utf8');
    eval(content);
  } else {
    console.log('Cargando config.js (Default)...');
    const content = fs.readFileSync(defaultConfigPath, 'utf8');
    eval(content);
  }
}

mockWindow();

const cfg = global.window.KPK_CONFIG || {};
const provider = cfg.aiProvider || 'openrouter';
const key = cfg.aiKeys ? cfg.aiKeys[provider] : '';

console.log('--- RESULTADOS DE VERIFICACIÓN DE CONFIGURACIÓN ---');
console.log('Proveedor IA Activo:', provider);
console.log('API Key configurada para este proveedor:', key ? 'SÍ (Clave cargada correctamente)' : 'NO (Vacío)');
console.log('Longitud de la clave:', key ? key.length : 0);
console.log('Prefijo de la clave:', key ? key.substring(0, 7) : 'Ninguno');
console.log('Versión de configuración de caché:', cfg.configVersion);
console.log('--------------------------------------------------');

if (provider === 'lightning' && key && key.startsWith('sk-lit-')) {
  console.log('✅ VERIFICACIÓN EXITOSA: El chatbot está configurado para correr con la API de Lightning por defecto.');
} else {
  console.log('❌ VERIFICACIÓN FALLIDA: Hay un error en la carga de configuración.');
}
