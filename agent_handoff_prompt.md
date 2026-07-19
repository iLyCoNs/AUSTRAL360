# Pauta de Continuación de Proyecto (Prompt de Traspaso)

Copia y pega el siguiente prompt al iniciar una nueva sesión de IA para que comprenda de inmediato la arquitectura, reglas de estilo y dinámicas del de este proyecto:

---

## CONTEXTO DEL PROYECTO
Estás trabajando en **Austral 360 / KPRANOKILLER**, una plataforma premium de visualización inmobiliaria en 360 grados. Los usuarios exploran terrenos virtuales interactuando con lotes dibujados sobre imágenes panorámicas y consultando servicios locales mediante un mapa interactivo.
El sistema cuenta con un copiloto de ventas de Inteligencia Actor (llamado **Gigi** para el tono femenino o **Jarvis** para el tono masculino) que interactúa con el cliente mediante voz y texto.

---

## ARQUITECTURA CLAVE Y MÓDULOS
1. **Pannellum 360 Viewer**: Visor panorámico 360 en el que se renderizan y seleccionan los polígonos de lotes (`window.allDrawnLines`).
2. **FerrariGeo (`js/core/f-geo.js`)**: Gestiona la geolocalización, coordenadas de lotes, pines de interés (POIs) y cálculo de distancias desde el origen del dron (`droneOrigin`).
3. **Copiloto IA (`ia/f-copilot.js` & `ia/f-copilot.css`)**: Controla la lógica de conversación, la síntesis de voz (TTS), el reconocimiento de voz (STT), y las interfaces de chat (móvil y escritorio).
4. **Dock de Compras (`js/ui/f-buyer-dock.js`)**: Controla los paneles laterales, fichas de lotes y el widget de mapa integrado.

---

## REGLAS CRÍTICAS DE IMPLEMENTACIÓN

### 1. Sistema de Mapeo y Rutas de Servicios
* **Campos de Pines**: Los marcadores cargados en `window.FerrariGeo.pins` NO contienen la propiedad `nombre`; su título se almacena en `titulo`. Siempre comprueba ambas propiedades (`p.titulo || p.nombre`).
* **Rutas desde Origen**: Al consultar por la ubicación de un servicio (colegios, playas, etc.), el mapa integrado en la interfaz de usuario de compras (`_focusPin` en `f-buyer-dock.js`) debe trazar una ruta de manejo de Google Maps desde el origen del dron (`droneOrigin`) hasta el punto de destino:
  `https://www.google.com/maps/embed/v1/directions?key=API_KEY&origin=LAT,LNG&destination=LAT,LNG`
  Evita renderizar un marcador estático genérico.

### 2. Motor de Voz (TTS) y Reconocimiento de Voz (STT)
* **Acento Latinoamericano Neutro**: La voz de Gigi/Jarvis debe sonar natural, con cadencia de español de Chile o región andina/latinoamericana. No debe usar términos peninsulares (evitar "vosotros", "vale", ceceo, "coche"). Debe usar terminología local como "departamento" o "auto".
* **Escucha Continua**: El micrófono debe permanecer escuchando en segundo plano en todo momento de forma persistente, incluso cuando el chatbot termine de hablar y oculte su burbuja de texto.
* **Autoplay de Audio**: Debido a restricciones del navegador, el primer audio de bienvenida en celular no se ejecuta hasta que el usuario realiza su primer toque (por ejemplo, al pulsar la burbuja de la IA `#kpk-ai-bubble` para activar la secuencia inicial).

### 3. Dinámica Visual Móvil (UI/UX Premium)
* **Burbuja Flotante Minimalista (`.kpk-mbp-minimal`)**: Cuando el chatbot está hablando en móvil y el usuario tiene activada la voz, la ventana emergente oculta la barra de título, los botones de acción y controles del footer. Se despliega únicamente como una **burbuja de texto translúcida flotante** para no obstruir la vista panorámica de los lotes.
* **Transición de Escritura**: Si el usuario toca la burbuja de texto minimalista o el botón flotante de la IA (`#kpk-ai-bubble`), la burbuja se expande eliminando la clase `.kpk-mbp-minimal` y activa inmediatamente el campo de entrada de texto (`#kpk-mbp-text-input`) con foco para permitir la escritura.
* **Resplandor de Silenciado (`.kpk-mute-glow`)**: Los botones de silencio de voz inician con una animación neón verde pulsante para guiar a los usuarios textuales sobre cómo desactivar la voz. Al silenciar la voz, este brillo se apaga y ambos botones (escritorio y móvil) sincronizan su estado visual de manera idéntica.

### 4. Caché e Indexación
* Cada vez que realices modificaciones en `ia/f-copilot.js`, `ia/f-copilot.css` o cualquier recurso principal, incrementa los parámetros de versión de los scripts (`?v=X`) en el archivo `index.html` para asegurar que el navegador cliente refresque los archivos inmediatamente.
* Valida la sintaxis del código de copiloto ejecutando en la consola: `node -c ia/f-copilot.js`.
