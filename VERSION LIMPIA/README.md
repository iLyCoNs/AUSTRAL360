# 🚀 AUSTRAL 360 — PLANTILLA VERSIÓN LIMPIA

Esta carpeta contiene la **Versión Limpia del Motor Austral 360**, completamente desprovista de trazados, parcelas dibujadas o coordenadas previas. Está lista para que inicies un nuevo proyecto de loteo desde cero.

---

## 📋 Pasos para Iniciar un Nuevo Loteo desde Cero:

### 1. Colocar tu nueva Fotografía Panorámica 360°:
* Copia tu nueva imagen equirrectangular 360° en la raíz de esta carpeta.
* Renómbrala como `loteo360.jpg` (o edita la ruta del archivo en la línea 448 de [index.html](index.html)).

### 2. Definir las Coordenadas Geográficas (Origen del Dron):
* Abre [admin.html](admin.html) en tu navegador o edita directamente [data/geo.json](data/geo.json).
* Ingresa la latitud (`lat`) y longitud (`lng`) de origen del dron.
* **El Motor de Autodescubrimiento Geográfico** calculará de inmediato todos los pueblos, ciudades y distancias cercanas para la IA Copilot de forma 100% automática.

### 3. Dibujar Parcelas y Trazados sobre la Vista 360°:
* Abre el panel de administración en tu navegador ([admin.html](admin.html)).
* Utiliza las herramientas de dibujo (Lote, Polígono o Calle) para trazar tus parcelas directamente sobre la vista 360°.
* Ingresa los precios (UF), dimensiones ($m^2$), estados (disponible/reservado/vendido) y nombres de cada parcela.
* Haz clic en **Guardar** para actualizar de forma automática los archivos [data/datos.json](data/datos.json) y [data/lotes.json](data/lotes.json).

### 4. Personalizar Nombre y Marca (Opcional):
* Edita [data/brand.json](data/brand.json) para cambiar el nombre del proyecto y agregar claves de IA si deseas personalizarlas.

---

## 📂 Estructura de la Versión Limpia:
- `index.html`: Visor comercial principal para clientes (360° + IA + Widgets + Dock).
- `admin.html`: Editor interactivo 360° para dibujar parcelas y establecer coordenadas.
- `data/`: Base de datos limpia (`brand.json`, `datos.json`, `geo.json`, `lotes.json`).
- `ia/`: Motor del copiloto IA con autodescubrimiento dinámico de entorno.
- `js/` & `css/`: Framework modular del visor (Pannellum, GeoTools, Weather, Finance, Calendar).
