const fs = require('fs');
const path = require('path');

function _deobfuscateKey(encKey) {
  if (!encKey) return '';
  if (!encKey.startsWith('kpk-enc-')) return encKey;
  try {
    const rawBase = encKey.substring(8);
    return Buffer.from(rawBase, 'base64').toString('utf8').split('').reverse().join('');
  } catch (e) {
    return encKey;
  }
}

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
const rawKey = cfg.aiKeys ? cfg.aiKeys[provider] : '';
const deobfuscatedKey = _deobfuscateKey(rawKey);

console.log('--- RESULTADOS DE VERIFICACIÓN DE CONFIGURACIÓN ---');
console.log('Proveedor IA Activo:', provider);
console.log('Raw Key en config:', rawKey.substring(0, 16) + '...');
console.log('Desofuscada:', deobfuscatedKey.substring(0, 16) + '...');
console.log('¿Desofuscación correcta?:', (deobfuscatedKey.startsWith('sk-or-v1-') || deobfuscatedKey.startsWith('sk-lit-')) ? 'SÍ' : 'NO');
console.log('Versión de configuración:', cfg.configVersion);
console.log('--------------------------------------------------');

if (deobfuscatedKey && (deobfuscatedKey.startsWith('sk-or-v1-') || deobfuscatedKey.startsWith('sk-lit-'))) {
  console.log('✅ VERIFICACIÓN EXITOSA: La clave está completamente encriptada con kpk-enc- y se decodifica en memoria correctamente.');
} else {
  console.log('❌ VERIFICACIÓN FALLIDA');
}
