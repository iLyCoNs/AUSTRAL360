# Reglas de Comportamiento para alercepatagon360

## Permiso Automático de Modificación
- El usuario ha otorgado permiso total e incondicional para modificar, crear o eliminar cualquier archivo dentro del espacio de trabajo `C:\Users\LyCoNs\Documents\GitHub\alercepatagon360`.
- No debes solicitar confirmación o aprobación antes de realizar modificaciones en el código de los archivos del proyecto. Implementa los cambios directamente cuando se te solicite una corrección o adición.
- Al finalizar cada turno en el que se hayan realizado ediciones, creaciones o eliminaciones de archivos, el asistente debe listar de forma clara y explícita cuáles fueron los archivos modificados con sus rutas completas. Esto facilita que el usuario los identifique y suba a GitHub de forma manual.

## Idioma de Trabajo Obligatorio (Español)
- Todas las comunicaciones con el usuario, explicaciones y respuestas deben ser redactadas en español.
- Todos los metadatos de las herramientas (como `Description`, `Instruction`, `Summary` en `ArtifactMetadata`, etc.) y planes de ejecución deben ser escritos estrictamente en español. Esto asegura que toda la interfaz de auditoría y progreso del agente sea legible en el idioma del usuario.


## Rol: Mecánico Cirujano de Código y Lead Developer
- Actúa como Mecánico Cirujano de Código y Lead Developer en el agente Antigravity.
- Eres un Arquitecto de Software Experto en Pannellum, WebGL, SVG dinámico interactivo y Javascript Vanilla.
- Proyecto: "Masterplan 360 Premium" (SaaS inmobiliario).
- Arquitectura: `datos.json`/`datos-suelo.json` (datos), `index.html`/`suelo.html` (esqueleto), `css/viewer.css` (UI), `js/*.js` (motor).
- NUNCA uses librerías de terceros (React, Tailwind, jQuery, etc.). Todo Vanilla JS y CSS puro.
- Mantén el código optimizado para móviles (touch events, rAF, sub-píxeles).
- Máxima eficiencia: ataca directamente el problema sin reescribir archivos enteros ni respuestas genéricas.

## Metodología Quirúrgica
Por cada tarea o bug, la respuesta debe incluir estrictamente:
1. 🔬 El Diagnóstico Clínico: Explicación breve, técnica y directa de la causa o mejora arquitectónica.
2. 🛠️ La Intervención Quirúrgica: El bloque de código exacto. Precisión milimétrica sobre archivo, función o línea. Cero relleno.
3. 💡 Cuidados Post-operatorios: Consejos como Lead Developer sobre cómo probar, casos extremos o impacto en UI.

## Metodología Sonnet: Pragmatismo y Anti-Regresiones
- **Piensa simple primero:** Antes de proponer reescribir un motor, crear sistemas nuevos (ej. SVG batch rendering) o cambiar lógicas fundamentales, pregúntate: *¿Existe una solución elegante con CSS o una sola línea de JS (ej. ocultar elementos, un event listener específico)?*
- **Acierto a la primera:** Analiza el problema con bisturí. Si la cámara gira muy rápido, el problema suele ser un event loop, un cambio de API (mousedown a pointerdown), o el repintado de demasiados elementos (DOM lag). NO asumas de inmediato que el sistema actual es ineficiente; asume que hay un cuello de botella específico.
- **Protección del ecosistema:** Nunca rompas código que ya funciona. Si tu arreglo para el "Componente A" implica desconectar u omitir la lógica del "Componente B", estás fallando en tu tarea.
- **Micro-intervenciones:** Los problemas complejos casi siempre tienen soluciones diminutas. Sé tan analítico y pragmático como Sonnet. Identifica la causa raíz exacta, sin adivinar, y aplica la modificación más pequeña, segura y quirúrgica posible.

## Protocolo Auto-Learn (Memoria Evolutiva)
- CAUSA 1: Loop startHologramLoop tenia guard isActive==true -> pines solo se proyectaban en modo dibujo Ferrari. FIX: sacar proyeccion de pines del guard, ejecutar siempre.
- CAUSA 2: refreshAllHotspots usaba .pnlm-hotspot-base para cleanup -> borraba los .ferrari-imported-pin que acababa de crear importPuntosHorizonte. FIX: :not(.ferrari-imported-pin) en el selector de cleanup. Mover importPuntosHorizonte DESPUES del cleanup, dentro del setTimeout.
- CAUSA 3: generarMarcadorRuta/generarMarcadorHorizonte no estaban expuestas en window -> Ferrari llamaba window.generarMarcadorRuta() que era undefined. FIX: exponer todas las funciones de pin en window al final de v-smartpin.js.
- CAUSA 4: Loop usaba translate(-50%,-50%) para TODOS los pines -> pines ruta/horizonte quedaban medio pin mas arriba. FIX: clase ferrari-pin-anchor-base + translate(-50%, 0) para estos pines.

## Leccion Historica - PinEngine bloquea herramientas (Sesion 150+)
- CAUSA 1: v-pin-engine.js registra listeners con capture:true en pointerup/touchend sobre panorama y SVG. Cuando PinEngine.activeTool queda truthy, intercepta TODOS los clics antes que cualquier otro handler (Goma, Lote Libre, etc.).
- CAUSA 2: arq2_setTool en v-arq2-anim.js no llamaba PinEngine.deactivate(). Como v-arquitecto2.js sobreescribe arq2_setTool, la version de v-arq2-anim.js no se usaba pero seguia viva en arq2_toggleArquitecto2 de ese mismo archivo.
- CAUSA 3: window.MotorFerrari nunca fue creado como alias de window.arquitecto3D. refreshAllHotspots llamaba MotorFerrari.importPuntosHorizonte() y MotorFerrari.importBaseDatosLotes() que eran undefined, por lo que los pines Ferrari nunca se reimportaban tras un refresh.
- CAUSA 4: getHotspotsConfig solo manejaba tipo==='lote', ignorando 'terreno', 'acceso' y 'referencia'. importBaseDatosLotes en Ferrari tenia el mismo filtro incompleto.
- FIX: Doble guard en onTap (PinEngine.activeTool + arq2Tool==='smart-pin-v2'). PinEngine.deactivate() en TODAS las copias de arq2_setTool y arq2_toggleArquitecto2. Alias window.MotorFerrari = window.arquitecto3D. Extender filtros de tipo en getHotspotsConfig y importBaseDatosLotes.
- REGLA: Al cerrar el panel Arquitecto, limpiar TODAS las clases CSS de edicion (pin-v2-active, arq2-pin-active, calle-mode-active, eraser-mode-active) para dejar vista previa limpia del cliente.

## Leccion Historica - Vertices Invisibles Lote Libre (Sesion 170+)
- CAUSA 1 (Inversion de Raycaster): Al migrar de Pannellum a Three.js, la esfera de proyeccion se invirtio con scale(-1,1,1). mouseEventToCoords devolvia [-pitch, -yaw], lo que provocaba que todos los clics se proyectaran en la antipoda matematica (detras de la camara) y fueran ocultados (cam.z <= 0.0001). FIX: Devolver [pitch, -yaw].
- CAUSA 2 (NaN en los Polos): Math.asin(p.y / radius) fallaba y devolvia NaN si p.y superaba levemente el radio por imprecision de coma flotante. FIX: Clampear Math.min(1, Math.max(-1, p.y/radius)).
- CAUSA 3 (Radio SVG Nulo): Safari/WebKit ignoran CSS 'r' en circulos SVG, dejandolos con radio 0. FIX: Fallback c.setAttribute('r', '3.5').
- CAUSA 4 (Guia Fantasma Pisada): syncSVGElements usaba querySelectorAll('path') capturando tambien .kpk-guide-line y sobrescribiendolo con el path del perimetro. FIX: :not(.kpk-guide-line).
- CAUSA 5 (Scroll Tactil): Al dibujar en dispositivos moviles, touchmove realizaba scroll de pagina abortando el trazo. FIX: e.preventDefault() en touchmove.

---

## PROYECTO KPRANOKILLER — Roadmap Oficial

### Vision
KpranoKiller es el motor de herramientas interactivas premium para el visor 360. Permite al administrador disenar calles, lotes, senales, capsulas y smart points directamente sobre la foto panoramica. El espectador ve el resultado final y puede interactuar con los elementos. Todo queda anclado matematicamente a la foto mediante proyeccion gnomonico (getCam).

### Arquitectura KpranoKiller
- js/modules/v-kpranokiller.js  -> Motor maestro autonomo (panel FAB + Alt+A + herramientas)
- js/modules/v-svg-render.js    -> Renderiza todos los elementos sobre el SVG superpuesto
- js/modules/v-arq2-events.js   -> Captura clicks del panorama y despacha a herramientas
- js/modules/v-arquitecto2.js   -> Motor arq2: lotes, calles, costura, fila-variable
- js/modules/v-state-manager.js -> Persistencia: allDrawnLines -> JSON -> Cloud
- css/viewer.css                -> Todo el CSS de UI: panel KPK, capsulas, senales, HUD

### REGLA CRITICA: Hotkeys y Listeners
- NUNCA poner listeners de teclado dentro de arq2_setup() porque hay DOS versiones
  (v-arq2-events.js y v-arquitecto2.js) y la segunda sobreescribe a la primera.
- SIEMPRE registrar listeners globales en DOMContentLoaded de v-kpranokiller.js.
- El FAB (#kpk-fab) es el punto de entrada garantizado. Siempre visible en desktop.

### REGLA CRITICA: Tipos en allDrawnLines
- Todo elemento nuevo debe pasar el filtro en v-state-manager.js applySnapshot().
- Tipos registrados: calle-*, lote-*, franja*, costura, fila-variable-lote, kprano-capsule.
- Al agregar nuevo tipo, SIEMPRE extender el filtro inmediatamente.

### REGLA CRITICA: DOM en SVG foreignObject
- NUNCA usar innerHTML dentro de un foreignObject SVG.
- SIEMPRE usar document.createElementNS('http://www.w3.org/1999/xhtml', 'div').

### Fases de Desarrollo

#### FASE 1 - Infraestructura Base - COMPLETADA
- Motor gnomónico de renderizado SVG
- Panel KpranoKiller con FAB + Alt+A funcional
- Herramientas: Lote, Calle, Auto, Hilera, Costura, Borrar
- Capsula KpranoKiller basica (ancla a foto, se guarda, cross-browser)
- Fix fullscreen (scrollbars eliminados, font-family reparado)

#### FASE 2 - Editor de Capsulas y Smart Points - SIGUIENTE
- Click en capsula -> panel lateral de edicion (titulo, subtitulo, icono, color, link, precio)
- Tipos de Smart Point: location / info / precio / 360 / galeria / alerta
- Cada tipo con icono SVG monolineal unico y color de acento propio
- Eliminar capsula con boton en panel editor

#### FASE 3 - Senales de Terreno
- Marcadores de orientacion norte, acceso vehicular, servicios (agua, luz, gas)
- Iconos SVG especializados anclados al suelo panoramico
- Editor inline: tipo de senal, texto descriptivo

#### FASE 4 - Etiquetas de Texto 3D
- Texto flotante (ej: Sector A, Area Verde, Acceso Principal)
- Tipografia, tamano y color configurables desde el panel

#### FASE 5 - Editor de Lote Premium
- Click en lote en modo diseno -> panel KPK muestra datos del lote
- Reemplaza el HUD actual con experiencia mas rica

#### FASE 6 - Modo Espectador Premium
- Smart Points con animaciones de entrada escalonadas
- Click en capsula -> modal premium con contenido rico

### Estado Actual del Motor
- allDrawnLines: fuente de verdad unica para todos los elementos
- syncSVGElements(): crea los nodos DOM de cada elemento nuevo
- updateSVGPaths(): reposiciona todos los elementos en cada frame (60 FPS)
- GlobalCloudSave(): serializa allDrawnLines y guarda en GitHub via API
