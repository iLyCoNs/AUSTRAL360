// v-kpk-stubs.js v2 — Stubs de funciones eliminadas en migración Pannellum → Three.js
// CARGADO ANTES que v-franja-curva.js para evitar ReferenceError en cadena de init

// ── Funciones del sistema global ────────────────────────────────
if (typeof window.setupDevModes === 'undefined') {
    window.setupDevModes = function () { console.log('[stubs] setupDevModes OK'); };
}
if (typeof window.togglePinsMode === 'undefined') {
    window.togglePinsMode = function (active) { window.isDevModePinsActive = !!active; };
}
if (typeof window.toggleDrawMode === 'undefined') {
    window.toggleDrawMode = function (active) { window.isDevModeDrawActive = !!active; };
}
if (typeof window.initPannellum === 'undefined') {
    window.initPannellum = function () { console.log('[stubs] initPannellum OK'); };
}
if (typeof window.runSplashScreen === 'undefined') {
    window.runSplashScreen = function () {};
}
if (typeof window.setupModalEditor === 'undefined') {
    window.setupModalEditor = function () {};
}
if (typeof window.setupInAppModal === 'undefined') {
    window.setupInAppModal = function () {};
}
if (typeof window.setupGlobalDelegation === 'undefined') {
    window.setupGlobalDelegation = function () {};
}
if (typeof window.setupSunEngine === 'undefined') {
    window.setupSunEngine = function () {};
}
if (typeof window.setupNavPinTouchInteractions === 'undefined') {
    window.setupNavPinTouchInteractions = function () {};
}

// ── Funciones de PIN V2 eliminadas del motor arq2 ───────────────
// arq2_setup() las llama directamente (v-arquitecto2.js:3056)
if (typeof window.arq2_bindPinV2Buttons === 'undefined') {
    window.arq2_bindPinV2Buttons = function () {
        console.log('[stubs] arq2_bindPinV2Buttons OK');
    };
}
if (typeof window.arq2_togglePinV2UI === 'undefined') {
    window.arq2_togglePinV2UI = function (visible) {
        console.log('[stubs] arq2_togglePinV2UI(' + visible + ') OK');
    };
}

// ── Funciones de exportacion ─────────────────────────────────────
if (typeof window.exportarInventarioCSV === 'undefined') {
    window.exportarInventarioCSV = function () {
        console.log('[stubs] exportarInventarioCSV stub');
    };
}

console.log('[v-kpk-stubs v2] Todos los stubs instalados.');
